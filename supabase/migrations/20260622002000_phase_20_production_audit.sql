alter type public.claim_status add value if not exists 'final_approval_pending';

create table if not exists public.vendor_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_type text not null check (contract_type in ('labour', 'machinery', 'fuel', 'material', 'service')),
  contract_code text not null,
  vendor_id text not null,
  vendor_name text not null,
  project_id uuid not null references public.projects(id) on delete restrict,
  project_name text not null,
  department_id uuid references public.departments(id) on delete set null,
  department_name text,
  cost_code_id uuid references public.project_cost_codes(id) on delete set null,
  start_date date not null,
  end_date date not null,
  status text not null check (status in ('draft', 'active', 'expired', 'inactive')),
  payment_terms text not null default '',
  gst_applicable boolean not null default false,
  tds_applicable boolean not null default false,
  remarks text not null default '',
  commercial_terms jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.user_profiles(id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (organization_id, contract_code)
);

create index if not exists idx_vendor_contracts_scope
  on public.vendor_contracts(organization_id, project_id, department_id, status);
create index if not exists idx_vendor_contracts_vendor
  on public.vendor_contracts(organization_id, vendor_id, contract_type);

drop trigger if exists set_vendor_contracts_updated_at on public.vendor_contracts;
create trigger set_vendor_contracts_updated_at
before update on public.vendor_contracts
for each row execute function public.set_updated_at();

alter table public.vendor_contracts enable row level security;

create policy "role scoped vendor contract read"
on public.vendor_contracts for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.current_user_role() in ('admin_hr', 'super_admin', 'accounts_officer')
    or (
      public.current_user_role() = 'hod'
      and department_id = (
        select department_id from public.user_profiles where id = auth.uid()
      )
    )
    or exists (
      select 1
      from public.user_project_assignments assignment
      where assignment.user_id = auth.uid()
        and assignment.project_id = vendor_contracts.project_id
        and assignment.status = 'active'
        and (assignment.end_date is null or assignment.end_date >= current_date)
    )
  )
);

create policy "admins create vendor contracts"
on public.vendor_contracts for insert to authenticated
with check (
  organization_id = public.current_organization_id()
  and created_by = auth.uid()
  and public.current_user_role() in ('admin_hr', 'super_admin')
);

create policy "admins update vendor contracts"
on public.vendor_contracts for update to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('admin_hr', 'super_admin')
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  recipient_user_id uuid not null references public.user_profiles(id) on delete cascade,
  channel text not null check (channel in ('email')),
  recipient_address text not null,
  status text not null check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  attempts int not null default 0,
  last_error text,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_deliveries enable row level security;
create policy "users view own notification deliveries"
on public.notification_deliveries for select to authenticated
using (
  recipient_user_id = auth.uid()
  or (
    organization_id = public.current_organization_id()
    and public.current_user_role() in ('admin_hr', 'super_admin')
  )
);

create or replace function public.attendance_punch(
  p_action text,
  p_project_id uuid default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy int default null
)
returns public.attendance
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_record public.attendance;
  v_profile public.user_profiles;
  v_project public.projects;
  v_project_id uuid;
  v_shift_id uuid;
  v_server_time time := localtime;
  v_distance_meters numeric;
begin
  if p_action not in ('check_in', 'check_out') then
    raise exception 'Unsupported attendance action';
  end if;

  select * into v_profile from public.user_profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'User profile not found';
  end if;

  select * into v_record
  from public.attendance
  where user_id = auth.uid() and date = current_date
  for update;

  v_project_id := coalesce(p_project_id, v_record.project_id);
  if v_project_id is null then
    raise exception 'A project is required for attendance';
  end if;

  if not exists (
    select 1
    from public.user_project_assignments assignment
    where assignment.user_id = auth.uid()
      and assignment.project_id = v_project_id
      and assignment.status = 'active'
      and assignment.start_date <= current_date
      and (assignment.end_date is null or assignment.end_date >= current_date)
  ) then
    raise exception 'You are not actively assigned to this project';
  end if;

  select * into v_project
  from public.projects
  where id = v_project_id
    and organization_id = v_profile.organization_id
    and status = 'active'
    and deleted_at is null;
  if v_project.id is null then
    raise exception 'Active project not found';
  end if;
  if p_latitude is null or p_longitude is null then
    raise exception 'GPS coordinates are required';
  end if;
  if p_accuracy is null or p_accuracy <= 0 or p_accuracy > 100 then
    raise exception 'GPS accuracy must be 100 metres or better';
  end if;
  if v_project.latitude is null or v_project.longitude is null then
    raise exception 'Project geofence is not configured';
  end if;

  v_distance_meters := 6371000 * 2 * asin(
    sqrt(
      power(sin(radians((p_latitude - v_project.latitude) / 2)), 2)
      + cos(radians(v_project.latitude))
      * cos(radians(p_latitude))
      * power(sin(radians((p_longitude - v_project.longitude) / 2)), 2)
    )
  );
  if v_distance_meters > v_project.geofence_radius then
    raise exception 'Outside project geofence: % metres from site', round(v_distance_meters);
  end if;

  select id into v_shift_id
  from public.shifts
  where status = 'active'
  order by start_time
  limit 1;

  if p_action = 'check_in' then
    if v_record.check_in_time is not null then
      raise exception 'Attendance already checked in for today';
    end if;
    insert into public.attendance (
      user_id, organization_id, department_id, project_id,
      reporting_manager_id, hod_user_id, shift_id, date,
      check_in_time, status, worked_hours,
      location_lat, location_lon, location_accuracy,
      created_by, updated_by
    ) values (
      auth.uid(), v_profile.organization_id, v_profile.department_id, v_project_id,
      coalesce(v_profile.reporting_manager_id, v_profile.manager_id),
      v_profile.hod_user_id, v_shift_id, current_date,
      v_server_time, 'present', 0,
      p_latitude, p_longitude, p_accuracy,
      auth.uid(), auth.uid()
    )
    returning * into v_record;
  else
    if v_record.id is null or v_record.check_in_time is null then
      raise exception 'Check in before checking out';
    end if;
    if v_record.check_out_time is not null then
      raise exception 'Attendance already checked out for today';
    end if;
    update public.attendance
    set
      check_out_time = v_server_time,
      worked_hours = greatest(
        extract(epoch from (v_server_time - check_in_time)) / 3600,
        0
      ),
      checkout_location_lat = p_latitude,
      checkout_location_lon = p_longitude,
      checkout_location_accuracy = p_accuracy,
      updated_by = auth.uid()
    where id = v_record.id
    returning * into v_record;
  end if;

  return v_record;
end;
$$;
