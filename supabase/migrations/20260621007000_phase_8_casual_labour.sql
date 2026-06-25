do $$
begin
  create type public.labour_category as enum (
    'male',
    'female',
    'supervisor'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.labour_attendance_status as enum (
    'present',
    'absent',
    'half_day',
    'on_leave'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.labour_record_status as enum (
    'draft',
    'submitted',
    'approved'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.casual_labour_vendors (
  id text primary key,
  name text not null,
  contact_person text,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.casual_labour_workers (
  id uuid primary key default gen_random_uuid(),
  labour_code text not null unique,
  full_name text not null,
  category public.labour_category not null,
  vendor_id text not null references public.casual_labour_vendors(id),
  default_daily_rate numeric(12, 2) not null default 0,
  status text not null default 'active',
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.casual_labour_attendance (
  id uuid primary key default gen_random_uuid(),
  attendance_number text not null unique,
  project_id uuid not null references public.projects(id),
  vendor_id text not null references public.casual_labour_vendors(id),
  date date not null,
  work_area text,
  work_description text,
  male_allocated int not null default 0,
  female_allocated int not null default 0,
  supervisor_allocated int not null default 0,
  status public.labour_record_status not null default 'draft',
  submitted_by uuid not null references public.user_profiles(id),
  submitted_at timestamptz,
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.casual_labour_attendance_rows (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.casual_labour_attendance(id) on delete cascade,
  worker_id uuid not null references public.casual_labour_workers(id),
  category public.labour_category not null,
  start_time time,
  end_time time,
  status public.labour_attendance_status not null default 'present',
  daily_rate numeric(12, 2) not null default 0,
  overtime_hours numeric(8, 2) not null default 0,
  overtime_rate numeric(12, 2) not null default 0,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_labour_workers_vendor_id on public.casual_labour_workers(vendor_id);
create index if not exists idx_labour_attendance_project_id on public.casual_labour_attendance(project_id);
create index if not exists idx_labour_attendance_vendor_id on public.casual_labour_attendance(vendor_id);
create index if not exists idx_labour_attendance_date on public.casual_labour_attendance(date);
create index if not exists idx_labour_attendance_status on public.casual_labour_attendance(status);
create unique index if not exists idx_labour_unique_submitted_day
on public.casual_labour_attendance(project_id, vendor_id, date)
where deleted_at is null and status <> 'draft';
create index if not exists idx_labour_rows_attendance_id on public.casual_labour_attendance_rows(attendance_id);

drop trigger if exists set_casual_labour_vendors_updated_at on public.casual_labour_vendors;
create trigger set_casual_labour_vendors_updated_at
before update on public.casual_labour_vendors
for each row execute function public.set_updated_at();

drop trigger if exists set_casual_labour_workers_updated_at on public.casual_labour_workers;
create trigger set_casual_labour_workers_updated_at
before update on public.casual_labour_workers
for each row execute function public.set_updated_at();

drop trigger if exists set_casual_labour_attendance_updated_at on public.casual_labour_attendance;
create trigger set_casual_labour_attendance_updated_at
before update on public.casual_labour_attendance
for each row execute function public.set_updated_at();

drop trigger if exists set_casual_labour_rows_updated_at on public.casual_labour_attendance_rows;
create trigger set_casual_labour_rows_updated_at
before update on public.casual_labour_attendance_rows
for each row execute function public.set_updated_at();

alter table public.casual_labour_vendors enable row level security;
alter table public.casual_labour_workers enable row level security;
alter table public.casual_labour_attendance enable row level security;
alter table public.casual_labour_attendance_rows enable row level security;

drop policy if exists "labour vendors visible to field roles" on public.casual_labour_vendors;
create policy "labour vendors visible to field roles"
on public.casual_labour_vendors for select
to authenticated
using (public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin'));

drop policy if exists "labour vendors managed by admin roles" on public.casual_labour_vendors;
create policy "labour vendors managed by admin roles"
on public.casual_labour_vendors for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "labour workers visible to field roles" on public.casual_labour_workers;
create policy "labour workers visible to field roles"
on public.casual_labour_workers for select
to authenticated
using (public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin'));

drop policy if exists "labour workers created by field roles" on public.casual_labour_workers;
create policy "labour workers created by field roles"
on public.casual_labour_workers for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin')
);

drop policy if exists "labour attendance visible to owner manager or admin" on public.casual_labour_attendance;
create policy "labour attendance visible to owner manager or admin"
on public.casual_labour_attendance for select
to authenticated
using (
  deleted_at is null
  and (
    submitted_by = auth.uid()
    or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "labour attendance created by field roles" on public.casual_labour_attendance;
create policy "labour attendance created by field roles"
on public.casual_labour_attendance for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin')
);

drop policy if exists "labour attendance updated by owner manager or admin" on public.casual_labour_attendance;
create policy "labour attendance updated by owner manager or admin"
on public.casual_labour_attendance for update
to authenticated
using (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
)
with check (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
);

drop policy if exists "labour rows visible with attendance" on public.casual_labour_attendance_rows;
create policy "labour rows visible with attendance"
on public.casual_labour_attendance_rows for select
to authenticated
using (
  exists (
    select 1
    from public.casual_labour_attendance a
    where a.id = attendance_id
      and a.deleted_at is null
      and (
        a.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "labour rows inserted with attendance" on public.casual_labour_attendance_rows;
create policy "labour rows inserted with attendance"
on public.casual_labour_attendance_rows for insert
to authenticated
with check (
  exists (
    select 1
    from public.casual_labour_attendance a
    where a.id = attendance_id
      and (
        a.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

insert into public.casual_labour_vendors (id, name, contact_person, phone, status)
values
  ('vendor-shakti-labour', 'Shakti Labour Supply', 'Mahesh Patel', '+91 98765 20101', 'active'),
  ('vendor-metro-labour', 'Metro Workforce Services', 'Anil Sharma', '+91 98765 20102', 'active'),
  ('vendor-apex-contractors', 'Apex Site Contractors', 'Farhan Khan', '+91 98765 20103', 'active')
on conflict (id) do update set
  name = excluded.name,
  contact_person = excluded.contact_person,
  phone = excluded.phone,
  status = excluded.status;
