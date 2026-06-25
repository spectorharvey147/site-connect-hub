do $$
begin
  create type public.fuel_type as enum (
    'diesel',
    'petrol',
    'engine_oil',
    'hydraulic_oil',
    'grease',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.fuel_source as enum (
    'advance',
    'cash'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.fuel_record_status as enum (
    'draft',
    'submitted',
    'approved'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.fuel_vendors (
  id text primary key,
  name text not null,
  contact_person text,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  project_id uuid not null references public.projects(id),
  receipt_date date not null,
  fuel_type public.fuel_type not null,
  vendor_id text not null references public.fuel_vendors(id),
  source public.fuel_source not null default 'cash',
  quantity numeric(12, 2) not null default 0,
  unit text not null default 'L',
  rate_per_unit numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  reference_number text,
  remarks text,
  status public.fuel_record_status not null default 'draft',
  submitted_by uuid not null references public.user_profiles(id),
  submitted_at timestamptz,
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint fuel_receipt_quantity_check check (quantity >= 0),
  constraint fuel_receipt_rate_check check (rate_per_unit >= 0)
);

create table if not exists public.fuel_issues (
  id uuid primary key default gen_random_uuid(),
  issue_number text not null unique,
  project_id uuid not null references public.projects(id),
  issue_date date not null,
  fuel_type public.fuel_type not null,
  unit text not null default 'L',
  opening_stock numeric(12, 2) not null default 0,
  total_issued numeric(12, 2) not null default 0,
  closing_stock numeric(12, 2) not null default 0,
  remarks text,
  status public.fuel_record_status not null default 'draft',
  submitted_by uuid not null references public.user_profiles(id),
  submitted_at timestamptz,
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint fuel_issue_total_check check (total_issued >= 0)
);

create table if not exists public.fuel_issue_rows (
  id uuid primary key default gen_random_uuid(),
  fuel_issue_id uuid not null references public.fuel_issues(id) on delete cascade,
  machine_asset_id uuid references public.machine_assets(id),
  machine_type public.machine_type not null,
  machine_number text not null,
  quantity_issued numeric(12, 2) not null default 0,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fuel_issue_row_quantity_check check (quantity_issued >= 0)
);

create index if not exists idx_fuel_receipts_project_id on public.fuel_receipts(project_id);
create index if not exists idx_fuel_receipts_vendor_id on public.fuel_receipts(vendor_id);
create index if not exists idx_fuel_receipts_date on public.fuel_receipts(receipt_date);
create index if not exists idx_fuel_receipts_status on public.fuel_receipts(status);
create index if not exists idx_fuel_issues_project_id on public.fuel_issues(project_id);
create index if not exists idx_fuel_issues_date on public.fuel_issues(issue_date);
create index if not exists idx_fuel_issues_status on public.fuel_issues(status);
create unique index if not exists idx_fuel_issue_unique_submitted_day
on public.fuel_issues(project_id, fuel_type, issue_date)
where deleted_at is null and status <> 'draft';
create index if not exists idx_fuel_issue_rows_issue_id on public.fuel_issue_rows(fuel_issue_id);
create index if not exists idx_fuel_issue_rows_machine_asset_id on public.fuel_issue_rows(machine_asset_id);

drop trigger if exists set_fuel_vendors_updated_at on public.fuel_vendors;
create trigger set_fuel_vendors_updated_at
before update on public.fuel_vendors
for each row execute function public.set_updated_at();

drop trigger if exists set_fuel_receipts_updated_at on public.fuel_receipts;
create trigger set_fuel_receipts_updated_at
before update on public.fuel_receipts
for each row execute function public.set_updated_at();

drop trigger if exists set_fuel_issues_updated_at on public.fuel_issues;
create trigger set_fuel_issues_updated_at
before update on public.fuel_issues
for each row execute function public.set_updated_at();

drop trigger if exists set_fuel_issue_rows_updated_at on public.fuel_issue_rows;
create trigger set_fuel_issue_rows_updated_at
before update on public.fuel_issue_rows
for each row execute function public.set_updated_at();

alter table public.fuel_vendors enable row level security;
alter table public.fuel_receipts enable row level security;
alter table public.fuel_issues enable row level security;
alter table public.fuel_issue_rows enable row level security;

drop policy if exists "fuel vendors visible to field roles" on public.fuel_vendors;
create policy "fuel vendors visible to field roles"
on public.fuel_vendors for select
to authenticated
using (public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin'));

drop policy if exists "fuel vendors managed by admin roles" on public.fuel_vendors;
create policy "fuel vendors managed by admin roles"
on public.fuel_vendors for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "fuel receipts visible to owner manager or admin" on public.fuel_receipts;
create policy "fuel receipts visible to owner manager or admin"
on public.fuel_receipts for select
to authenticated
using (
  deleted_at is null
  and (
    submitted_by = auth.uid()
    or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "fuel receipts created by field roles" on public.fuel_receipts;
create policy "fuel receipts created by field roles"
on public.fuel_receipts for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin')
);

drop policy if exists "fuel receipts updated by owner manager or admin" on public.fuel_receipts;
create policy "fuel receipts updated by owner manager or admin"
on public.fuel_receipts for update
to authenticated
using (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
)
with check (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
);

drop policy if exists "fuel issues visible to owner manager or admin" on public.fuel_issues;
create policy "fuel issues visible to owner manager or admin"
on public.fuel_issues for select
to authenticated
using (
  deleted_at is null
  and (
    submitted_by = auth.uid()
    or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "fuel issues created by field roles" on public.fuel_issues;
create policy "fuel issues created by field roles"
on public.fuel_issues for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin')
);

drop policy if exists "fuel issues updated by owner manager or admin" on public.fuel_issues;
create policy "fuel issues updated by owner manager or admin"
on public.fuel_issues for update
to authenticated
using (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
)
with check (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
);

drop policy if exists "fuel issue rows visible with issue" on public.fuel_issue_rows;
create policy "fuel issue rows visible with issue"
on public.fuel_issue_rows for select
to authenticated
using (
  exists (
    select 1
    from public.fuel_issues i
    where i.id = fuel_issue_id
      and i.deleted_at is null
      and (
        i.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "fuel issue rows inserted with issue" on public.fuel_issue_rows;
create policy "fuel issue rows inserted with issue"
on public.fuel_issue_rows for insert
to authenticated
with check (
  exists (
    select 1
    from public.fuel_issues i
    where i.id = fuel_issue_id
      and (
        i.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

insert into public.fuel_vendors (id, name, contact_person, phone, status)
values
  ('vendor-apex-fuel', 'Apex Fuel Supply', 'Nikhil Rao', '+91 98765 40101', 'active'),
  ('vendor-city-petroleum', 'City Petroleum Depot', 'Savita Kulkarni', '+91 98765 40102', 'active'),
  ('vendor-shakti-lubes', 'Shakti Lubricants', 'Aman Verma', '+91 98765 40103', 'active')
on conflict (id) do update set
  name = excluded.name,
  contact_person = excluded.contact_person,
  phone = excluded.phone,
  status = excluded.status;
