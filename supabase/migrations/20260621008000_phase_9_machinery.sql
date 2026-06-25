do $$
begin
  create type public.machine_type as enum (
    'excavator',
    'jcb',
    'dumper',
    'compactor',
    'crane',
    'concrete_mixer',
    'pump',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.machine_ownership as enum (
    'company_owned',
    'rented',
    'hired'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.machine_log_status as enum (
    'draft',
    'submitted',
    'approved'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.machinery_billing_cycle as enum (
    'monthly',
    'weekly',
    'daily',
    'per_trip'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.machinery_vendors (
  id text primary key,
  name text not null,
  contact_person text,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machine_assets (
  id uuid primary key default gen_random_uuid(),
  machine_number text not null unique,
  machine_type public.machine_type not null,
  ownership public.machine_ownership not null,
  vendor_id text references public.machinery_vendors(id),
  project_id uuid references public.projects(id),
  status text not null default 'active',
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machinery_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null unique,
  vendor_id text not null references public.machinery_vendors(id),
  machine_type public.machine_type not null,
  machine_numbers text[] not null default '{}',
  period_from date not null,
  period_to date not null,
  billing_cycle public.machinery_billing_cycle not null default 'monthly',
  rate numeric(12, 2) not null default 0,
  working_days_per_month int not null default 26,
  overtime_rate_per_hour numeric(12, 2) not null default 0,
  fuel_scope text not null default 'excluded',
  driver_cost_scope text not null default 'included',
  special_terms text,
  status text not null default 'active',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint machinery_contract_period_check check (period_to >= period_from)
);

create table if not exists public.machine_logs (
  id uuid primary key default gen_random_uuid(),
  log_number text not null unique,
  project_id uuid not null references public.projects(id),
  machine_asset_id uuid not null references public.machine_assets(id),
  log_date date not null,
  meter_start numeric(12, 2) not null default 0,
  meter_end numeric(12, 2) not null default 0,
  total_meter_hours numeric(12, 2) not null default 0,
  breakdown boolean not null default false,
  breakdown_start_time time,
  breakdown_duration_hours numeric(8, 2) not null default 0,
  breakdown_reason text,
  breakdown_resolution text,
  remarks text,
  status public.machine_log_status not null default 'draft',
  submitted_by uuid not null references public.user_profiles(id),
  submitted_at timestamptz,
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint machine_log_meter_check check (meter_end >= meter_start)
);

create table if not exists public.machine_log_sessions (
  id uuid primary key default gen_random_uuid(),
  machine_log_id uuid not null references public.machine_logs(id) on delete cascade,
  start_time time not null,
  end_time time not null,
  hours numeric(8, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machine_log_session_time_check check (end_time > start_time)
);

create index if not exists idx_machine_assets_vendor_id on public.machine_assets(vendor_id);
create index if not exists idx_machine_assets_project_id on public.machine_assets(project_id);
create index if not exists idx_machinery_contracts_vendor_id on public.machinery_contracts(vendor_id);
create index if not exists idx_machinery_contracts_status on public.machinery_contracts(status);
create index if not exists idx_machine_logs_project_id on public.machine_logs(project_id);
create index if not exists idx_machine_logs_asset_id on public.machine_logs(machine_asset_id);
create index if not exists idx_machine_logs_log_date on public.machine_logs(log_date);
create index if not exists idx_machine_logs_status on public.machine_logs(status);
create unique index if not exists idx_machine_log_unique_submitted_day
on public.machine_logs(machine_asset_id, log_date)
where deleted_at is null and status <> 'draft';
create index if not exists idx_machine_log_sessions_log_id on public.machine_log_sessions(machine_log_id);

drop trigger if exists set_machinery_vendors_updated_at on public.machinery_vendors;
create trigger set_machinery_vendors_updated_at
before update on public.machinery_vendors
for each row execute function public.set_updated_at();

drop trigger if exists set_machine_assets_updated_at on public.machine_assets;
create trigger set_machine_assets_updated_at
before update on public.machine_assets
for each row execute function public.set_updated_at();

drop trigger if exists set_machinery_contracts_updated_at on public.machinery_contracts;
create trigger set_machinery_contracts_updated_at
before update on public.machinery_contracts
for each row execute function public.set_updated_at();

drop trigger if exists set_machine_logs_updated_at on public.machine_logs;
create trigger set_machine_logs_updated_at
before update on public.machine_logs
for each row execute function public.set_updated_at();

drop trigger if exists set_machine_log_sessions_updated_at on public.machine_log_sessions;
create trigger set_machine_log_sessions_updated_at
before update on public.machine_log_sessions
for each row execute function public.set_updated_at();

alter table public.machinery_vendors enable row level security;
alter table public.machine_assets enable row level security;
alter table public.machinery_contracts enable row level security;
alter table public.machine_logs enable row level security;
alter table public.machine_log_sessions enable row level security;

drop policy if exists "machinery vendors visible to field roles" on public.machinery_vendors;
create policy "machinery vendors visible to field roles"
on public.machinery_vendors for select
to authenticated
using (public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin'));

drop policy if exists "machinery vendors managed by admin roles" on public.machinery_vendors;
create policy "machinery vendors managed by admin roles"
on public.machinery_vendors for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "machine assets visible to field roles" on public.machine_assets;
create policy "machine assets visible to field roles"
on public.machine_assets for select
to authenticated
using (public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin'));

drop policy if exists "machine assets managed by admin roles" on public.machine_assets;
create policy "machine assets managed by admin roles"
on public.machine_assets for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "machinery contracts visible to field roles" on public.machinery_contracts;
create policy "machinery contracts visible to field roles"
on public.machinery_contracts for select
to authenticated
using (
  deleted_at is null
  and public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin')
);

drop policy if exists "machinery contracts managed by admin roles" on public.machinery_contracts;
create policy "machinery contracts managed by admin roles"
on public.machinery_contracts for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (
  created_by = auth.uid()
  and public.current_user_role() in ('admin_hr', 'super_admin')
);

drop policy if exists "machine logs visible to owner manager or admin" on public.machine_logs;
create policy "machine logs visible to owner manager or admin"
on public.machine_logs for select
to authenticated
using (
  deleted_at is null
  and (
    submitted_by = auth.uid()
    or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "machine logs created by field roles" on public.machine_logs;
create policy "machine logs created by field roles"
on public.machine_logs for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin')
);

drop policy if exists "machine logs updated by owner manager or admin" on public.machine_logs;
create policy "machine logs updated by owner manager or admin"
on public.machine_logs for update
to authenticated
using (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
)
with check (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
);

drop policy if exists "machine log sessions visible with log" on public.machine_log_sessions;
create policy "machine log sessions visible with log"
on public.machine_log_sessions for select
to authenticated
using (
  exists (
    select 1
    from public.machine_logs l
    where l.id = machine_log_id
      and l.deleted_at is null
      and (
        l.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "machine log sessions inserted with log" on public.machine_log_sessions;
create policy "machine log sessions inserted with log"
on public.machine_log_sessions for insert
to authenticated
with check (
  exists (
    select 1
    from public.machine_logs l
    where l.id = machine_log_id
      and (
        l.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

insert into public.machinery_vendors (id, name, contact_person, phone, status)
values
  ('vendor-apex-machinery', 'Apex Plant & Machinery', 'Rajat Menon', '+91 98765 30101', 'active'),
  ('vendor-steel-equip', 'Steel Equip Rentals', 'Preeti Shah', '+91 98765 30102', 'active'),
  ('vendor-city-cranes', 'City Crane Services', 'Imran Qureshi', '+91 98765 30103', 'active')
on conflict (id) do update set
  name = excluded.name,
  contact_person = excluded.contact_person,
  phone = excluded.phone,
  status = excluded.status;
