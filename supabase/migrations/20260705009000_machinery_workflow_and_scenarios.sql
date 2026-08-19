create table if not exists public.machinery_usage_bills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  vendor_id text references public.vendors(id),
  contract_id uuid references public.vendor_contracts(id),
  machine_log_id uuid not null unique references public.machine_logs(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  usage_hours numeric(10,2) not null default 0 check (usage_hours >= 0),
  trip_count numeric(12,2) not null default 0 check (trip_count >= 0),
  base_amount numeric(14,2) not null default 0 check (base_amount >= 0),
  breakdown_deduction numeric(14,2) not null default 0 check (breakdown_deduction >= 0),
  net_amount numeric(14,2) not null default 0 check (
    net_amount = base_amount - breakdown_deduction and net_amount >= 0
  ),
  status text not null default 'approved' check (status in ('approved','billed','paid','cancelled')),
  vendor_bill_id uuid references public.vendor_bills(id),
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_machinery_usage_bills_scope
  on public.machinery_usage_bills(organization_id, project_id, vendor_id, status, period_from);

alter table public.machinery_usage_bills enable row level security;
create policy "machinery usage bills authorized read"
on public.machinery_usage_bills for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('manager','hod','accounts_officer','admin_hr','super_admin')
);
create policy "machinery usage bills approver insert"
on public.machinery_usage_bills for insert to authenticated
with check (
  organization_id = public.current_organization_id()
  and created_by = auth.uid()
  and public.current_user_role() in ('manager','hod','admin_hr','super_admin')
);
create policy "machinery usage bills finance update"
on public.machinery_usage_bills for update to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('accounts_officer','admin_hr','super_admin')
)
with check (organization_id = public.current_organization_id());

create or replace function public.guard_machine_log_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_role text;
begin
  if auth.uid() is null then return new; end if;
  actor_role := public.current_user_role();
  if old.status = 'approved' and new.status is distinct from old.status then
    raise exception 'Approved machine logs cannot be reopened';
  end if;
  if new.status = 'approved' and old.status <> 'submitted' then
    raise exception 'Only submitted machine logs can be approved';
  end if;
  if new.status = 'approved' and actor_role not in ('manager','hod','admin_hr','super_admin') then
    raise exception 'Only an authorised approver can approve machine logs';
  end if;
  if new.approved_by is distinct from old.approved_by and new.approved_by is distinct from auth.uid() then
    raise exception 'approved_by must match the authenticated approver';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_machine_log_transition on public.machine_logs;
create trigger guard_machine_log_transition before update on public.machine_logs
for each row execute function public.guard_machine_log_transition();

create or replace function public.approve_machine_log(target_log_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare machine_log public.machine_logs%rowtype;
declare actor_id uuid := auth.uid();
declare actor_role text := public.current_user_role();
declare breakdown_deduction numeric(14,2);
declare base_amount numeric(14,2);
begin
  if actor_id is null or actor_role not in ('manager','hod','admin_hr','super_admin') then
    raise exception 'Only an authorised approver can approve machine logs';
  end if;
  select * into machine_log from public.machine_logs where id = target_log_id for update;
  if not found then raise exception 'Machine log not found'; end if;
  if machine_log.status <> 'submitted' then raise exception 'Only submitted machine logs can be approved'; end if;
  if not exists (select 1 from public.machine_log_sessions where machine_log_id = target_log_id) then
    raise exception 'Machine log must have at least one usage session';
  end if;

  select coalesce(sum(deduction_amount),0) into breakdown_deduction
  from public.machine_breakdowns where machine_log_id = target_log_id;
  base_amount := machine_log.calculated_cost + breakdown_deduction;

  insert into public.machinery_usage_bills (
    organization_id, project_id, vendor_id, contract_id, machine_log_id,
    period_from, period_to, usage_hours, trip_count, base_amount,
    breakdown_deduction, net_amount, status, created_by
  ) values (
    machine_log.organization_id, machine_log.project_id, machine_log.vendor_id,
    machine_log.contract_id, machine_log.id, machine_log.log_date,
    machine_log.log_date, machine_log.total_meter_hours, machine_log.trip_count,
    base_amount, breakdown_deduction, machine_log.calculated_cost, 'approved', actor_id
  ) on conflict (machine_log_id) do update set
    usage_hours = excluded.usage_hours, trip_count = excluded.trip_count,
    base_amount = excluded.base_amount, breakdown_deduction = excluded.breakdown_deduction,
    net_amount = excluded.net_amount, status = 'approved', updated_at = now();

  update public.machine_logs set status = 'approved', approved_by = actor_id, approved_at = now()
  where id = target_log_id;
  return target_log_id;
end;
$$;
revoke all on function public.approve_machine_log(uuid) from public;
grant execute on function public.approve_machine_log(uuid) to authenticated;

-- HOD route/service alignment.
drop policy if exists "machine logs visible to owner manager or admin" on public.machine_logs;
create policy "machine logs visible to owner manager or admin"
on public.machine_logs for select to authenticated using (
  deleted_at is null and (
    submitted_by = auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin')
  )
);
drop policy if exists "machine logs created by field roles" on public.machine_logs;
create policy "machine logs created by field roles"
on public.machine_logs for insert to authenticated with check (
  submitted_by = auth.uid()
  and public.current_user_role() in ('site_staff','manager','hod','admin_hr','super_admin')
);
drop policy if exists "machine logs updated by owner manager or admin" on public.machine_logs;
create policy "machine logs updated by owner manager or admin"
on public.machine_logs for update to authenticated
using (submitted_by = auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin'))
with check (submitted_by = auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin'));

do $$
declare
  contract_id constant uuid := 'f872ff63-bc0f-41ef-b2ae-9afe8f388b9a';
  org_id constant uuid := '10000000-0000-4000-8000-000000000001';
  project_id constant uuid := '50000000-0000-4000-8000-000000000001';
  field_user constant uuid := '30000000-0000-4000-8000-000000000006';
  manager_user constant uuid := '30000000-0000-4000-8000-000000000003';
  asset_4821 uuid; asset_4930 uuid; asset_5074 uuid;
begin
  select id into asset_4821 from public.machine_assets where machine_number = 'TN-09-EX-4821';
  select id into asset_4930 from public.machine_assets where machine_number = 'TN-09-EX-4930';
  select id into asset_5074 from public.machine_assets where machine_number = 'TN-09-EX-5074';
  if asset_4821 is null or asset_4930 is null or asset_5074 is null then
    return;
  end if;

  delete from public.machine_logs where id in (
    '81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003'
  );
  insert into public.machine_logs (
    id, organization_id, project_id, vendor_id, contract_id, log_number,
    machine_asset_id, log_date, meter_start, meter_end, total_meter_hours,
    breakdown, breakdown_start_time, breakdown_duration_hours, breakdown_reason,
    breakdown_resolution, remarks, status, submitted_by, submitted_at,
    approved_by, approved_at, billing_type, billing_rate, calculated_cost,
    trip_count, source_location, destination_location, load_type,
    operational_status, created_by
  ) values
    ('81000000-0000-4000-8000-000000000001',org_id,project_id,'vendor-vertex-equipment',contract_id,'MLOG-CMRL-2026-0701-D',asset_4821,'2026-07-01',1240,1248,8,false,null,0,null,null,'Excavation at north diaphragm wall','draft',field_user,null,null,null,'hourly',2850,22800,0,null,null,'Earth','active',field_user),
    ('81000000-0000-4000-8000-000000000002',org_id,project_id,'vendor-vertex-equipment',contract_id,'MLOG-CMRL-2026-0702-S',asset_4930,'2026-07-02',876.5,885,8.5,false,null,0,null,null,'Foundation excavation and spoil loading','submitted',field_user,'2026-07-02 18:20:00+05:30',null,null,'hourly',2850,24400,18,'Station Box North','Approved disposal yard','Excavated earth','active',field_user),
    ('81000000-0000-4000-8000-000000000003',org_id,project_id,'vendor-vertex-equipment',contract_id,'MLOG-CMRL-2026-0703-A',asset_5074,'2026-07-03',510,518,8,true,'13:00',3,'Hydraulic hose rupture','Hose replaced and pressure tested','Three-hour breakdown with contractual deduction','approved',field_user,'2026-07-03 18:10:00+05:30',manager_user,'2026-07-04 09:10:00+05:30','hourly',2850,13200,8,'Pier P121','Temporary spoil stack','Excavated earth','breakdown',field_user);

  insert into public.machine_log_sessions (id,machine_log_id,start_time,end_time,hours,remarks) values
    ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','09:00','17:00',8,'Draft shift'),
    ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','08:30','13:00',4.5,'Morning excavation'),
    ('82000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000002','14:00','18:00',4,'Afternoon loading'),
    ('82000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000003','08:00','13:00',5,'Operation before breakdown'),
    ('82000000-0000-4000-8000-000000000005','81000000-0000-4000-8000-000000000003','16:00','19:00',3,'Operation after repair');

  insert into public.machine_breakdowns (
    id,organization_id,project_id,vendor_id,machine_log_id,breakdown_start,
    breakdown_end,duration_hours,reason,resolution,deduction_amount,status,
    remarks,created_by
  ) values (
    '83000000-0000-4000-8000-000000000001',org_id,project_id,'vendor-vertex-equipment',
    '81000000-0000-4000-8000-000000000003','2026-07-03 13:00:00+05:30',
    '2026-07-03 16:00:00+05:30',3,'Hydraulic hose rupture',
    'Hose replaced and pressure tested',9600,'resolved','Deduction at contractual OT rate',field_user
  );

  insert into public.machinery_usage_bills (
    id,organization_id,project_id,vendor_id,contract_id,machine_log_id,
    period_from,period_to,usage_hours,trip_count,base_amount,
    breakdown_deduction,net_amount,status,created_by
  ) values (
    '84000000-0000-4000-8000-000000000001',org_id,project_id,'vendor-vertex-equipment',
    contract_id,'81000000-0000-4000-8000-000000000003','2026-07-03','2026-07-03',
    8,8,22800,9600,13200,'approved',manager_user
  );
end $$;

notify pgrst, 'reload schema';
