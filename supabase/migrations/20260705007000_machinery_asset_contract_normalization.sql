-- Unify machine assets with production vendors and vendor contracts.
alter table public.machine_assets
  drop constraint if exists machine_assets_vendor_id_fkey;

alter table public.machine_assets
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists vendor_contract_id uuid references public.vendor_contracts(id) on delete set null,
  add column if not exists contract_machine_id uuid references public.machinery_contract_machines(id) on delete set null,
  add column if not exists registration_number text,
  add column if not exists capacity text,
  add column if not exists remarks text;

alter table public.machine_assets
  add constraint machine_assets_vendor_id_fkey
  foreign key (vendor_id) references public.vendors(id);

update public.machine_assets asset
set organization_id = project.organization_id
from public.projects project
where asset.project_id = project.id
  and asset.organization_id is null;

update public.machine_assets
set organization_id = '10000000-0000-4000-8000-000000000001'
where organization_id is null;

create or replace function public.machine_type_from_label(label text)
returns public.machine_type
language sql
immutable
set search_path = public
as $$
  select case
    when lower(coalesce(label, '')) like '%excavat%' then 'excavator'::public.machine_type
    when lower(coalesce(label, '')) like '%jcb%' then 'jcb'::public.machine_type
    when lower(coalesce(label, '')) like '%dump%' then 'dumper'::public.machine_type
    when lower(coalesce(label, '')) like '%compact%' or lower(coalesce(label, '')) like '%roller%' then 'compactor'::public.machine_type
    when lower(coalesce(label, '')) like '%crane%' then 'crane'::public.machine_type
    when lower(coalesce(label, '')) like '%mix%' then 'concrete_mixer'::public.machine_type
    when lower(coalesce(label, '')) like '%pump%' then 'pump'::public.machine_type
    else 'other'::public.machine_type
  end;
$$;

create or replace function public.sync_contract_machine_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare asset_ownership public.machine_ownership;
begin
  if new.vendor_id is null then return new; end if;
  asset_ownership := case new.ownership
    when 'company' then 'company_owned'::public.machine_ownership
    when 'hired' then 'hired'::public.machine_ownership
    else 'rented'::public.machine_ownership
  end;

  insert into public.machine_assets (
    organization_id, machine_number, machine_type, ownership, vendor_id,
    project_id, vendor_contract_id, contract_machine_id, registration_number,
    capacity, remarks, status, created_by, updated_by
  ) values (
    new.organization_id, new.machine_number,
    public.machine_type_from_label(new.machine_type), asset_ownership,
    new.vendor_id, new.project_id, coalesce(new.vendor_contract_id, new.contract_id),
    new.id, new.registration_number, new.capacity, new.remarks, new.status,
    new.created_by, new.updated_by
  )
  on conflict (machine_number) do update set
    organization_id = excluded.organization_id,
    machine_type = excluded.machine_type,
    ownership = excluded.ownership,
    vendor_id = excluded.vendor_id,
    project_id = excluded.project_id,
    vendor_contract_id = excluded.vendor_contract_id,
    contract_machine_id = excluded.contract_machine_id,
    registration_number = excluded.registration_number,
    capacity = excluded.capacity,
    remarks = excluded.remarks,
    status = excluded.status,
    updated_by = excluded.updated_by,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists sync_contract_machine_asset
on public.machinery_contract_machines;
create trigger sync_contract_machine_asset
after insert or update of machine_number, machine_type, ownership, vendor_id,
  project_id, vendor_contract_id, contract_id, registration_number, capacity,
  remarks, status
on public.machinery_contract_machines
for each row execute function public.sync_contract_machine_asset();

-- Backfill every real contract machine through the same synchronization path.
update public.machinery_contract_machines
set updated_at = now()
where vendor_id is not null;

create index if not exists idx_machine_assets_org_scope
  on public.machine_assets(organization_id, project_id, vendor_id, status);
create index if not exists idx_machine_assets_vendor_contract
  on public.machine_assets(vendor_contract_id, status);
create unique index if not exists idx_machine_assets_contract_machine
  on public.machine_assets(contract_machine_id)
  where contract_machine_id is not null;

-- Repair legacy log metadata and session hours.
update public.machine_logs log
set organization_id = project.organization_id,
    created_by = coalesce(log.created_by, log.submitted_by)
from public.projects project
where project.id = log.project_id
  and (log.organization_id is null or log.created_by is null);

update public.machine_log_sessions
set hours = extract(epoch from (end_time - start_time)) / 3600
where hours = 0 and end_time > start_time;

drop policy if exists "machine assets visible to field roles" on public.machine_assets;
create policy "machine assets visible to field roles"
on public.machine_assets for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('site_staff', 'manager', 'hod', 'admin_hr', 'super_admin')
);

drop policy if exists "machine assets managed by admin roles" on public.machine_assets;
create policy "machine assets managed by admin roles"
on public.machine_assets for all to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('admin_hr', 'super_admin')
)
with check (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('admin_hr', 'super_admin')
);

notify pgrst, 'reload schema';
