do $$
begin
  create type public.leave_status as enum (
    'draft',
    'submitted',
    'pending',
    'approved',
    'rejected',
    'withdrawn'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  annual_allowance numeric(6, 2) not null default 0,
  carry_forward boolean not null default false,
  requires_document boolean not null default false,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  location text not null default 'India',
  holiday_type text not null default 'company',
  status text not null default 'active',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, location, name)
);

create table if not exists public.leave_applications (
  id uuid primary key default gen_random_uuid(),
  leave_number text not null unique,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  manager_id uuid references public.user_profiles(id),
  leave_type_id uuid not null references public.leave_types(id),
  from_date date not null,
  to_date date not null,
  number_of_days numeric(6, 2) not null,
  reason text not null,
  status public.leave_status not null default 'pending',
  applied_at timestamptz not null default now(),
  approved_by uuid references public.user_profiles(id),
  approval_date timestamptz,
  rejection_reason text,
  comments text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.leave_attachments (
  id uuid primary key default gen_random_uuid(),
  leave_id uuid not null references public.leave_applications(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text,
  file_size int,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.leave_approval_history (
  id uuid primary key default gen_random_uuid(),
  leave_id uuid not null references public.leave_applications(id) on delete cascade,
  actor_id uuid not null references public.user_profiles(id),
  actor_role text not null,
  decision text not null,
  comments text,
  created_at timestamptz not null default now()
);

create index if not exists idx_leave_applications_user_id on public.leave_applications(user_id);
create index if not exists idx_leave_applications_manager_id on public.leave_applications(manager_id);
create index if not exists idx_leave_applications_status on public.leave_applications(status);
create index if not exists idx_leave_applications_dates on public.leave_applications(from_date, to_date);
create index if not exists idx_leave_attachments_leave_id on public.leave_attachments(leave_id);
create index if not exists idx_leave_history_leave_id on public.leave_approval_history(leave_id);
create index if not exists idx_holidays_date on public.holidays(date);

drop trigger if exists set_leave_types_updated_at on public.leave_types;
create trigger set_leave_types_updated_at
before update on public.leave_types
for each row execute function public.set_updated_at();

drop trigger if exists set_holidays_updated_at on public.holidays;
create trigger set_holidays_updated_at
before update on public.holidays
for each row execute function public.set_updated_at();

drop trigger if exists set_leave_applications_updated_at on public.leave_applications;
create trigger set_leave_applications_updated_at
before update on public.leave_applications
for each row execute function public.set_updated_at();

alter table public.leave_types enable row level security;
alter table public.holidays enable row level security;
alter table public.leave_applications enable row level security;
alter table public.leave_attachments enable row level security;
alter table public.leave_approval_history enable row level security;

drop policy if exists "leave types visible to authenticated users" on public.leave_types;
create policy "leave types visible to authenticated users"
on public.leave_types for select
to authenticated
using (status = 'active');

drop policy if exists "leave types managed by admin roles" on public.leave_types;
create policy "leave types managed by admin roles"
on public.leave_types for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "holidays visible to authenticated users" on public.holidays;
create policy "holidays visible to authenticated users"
on public.holidays for select
to authenticated
using (status = 'active');

drop policy if exists "holidays managed by admin roles" on public.holidays;
create policy "holidays managed by admin roles"
on public.holidays for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "leave visible by owner or role" on public.leave_applications;
create policy "leave visible by owner or role"
on public.leave_applications for select
to authenticated
using (
  deleted_at is null
  and (
    user_id = auth.uid()
    or manager_id = auth.uid()
    or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "users create own leave" on public.leave_applications;
create policy "users create own leave"
on public.leave_applications for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "leave updated by owner manager or admin" on public.leave_applications;
create policy "leave updated by owner manager or admin"
on public.leave_applications for update
to authenticated
using (
  user_id = auth.uid()
  or manager_id = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
)
with check (
  user_id = auth.uid()
  or manager_id = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
);

drop policy if exists "leave attachments visible with leave" on public.leave_attachments;
create policy "leave attachments visible with leave"
on public.leave_attachments for select
to authenticated
using (
  exists (
    select 1
    from public.leave_applications l
    where l.id = leave_id
      and (
        l.user_id = auth.uid()
        or l.manager_id = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "leave attachments inserted by owner" on public.leave_attachments;
create policy "leave attachments inserted by owner"
on public.leave_attachments for insert
to authenticated
with check (uploaded_by = auth.uid());

drop policy if exists "leave history visible with leave" on public.leave_approval_history;
create policy "leave history visible with leave"
on public.leave_approval_history for select
to authenticated
using (
  exists (
    select 1
    from public.leave_applications l
    where l.id = leave_id
      and (
        l.user_id = auth.uid()
        or l.manager_id = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "leave history inserted by workflow actors" on public.leave_approval_history;
create policy "leave history inserted by workflow actors"
on public.leave_approval_history for insert
to authenticated
with check (actor_id = auth.uid());

insert into public.leave_types (
  id,
  code,
  name,
  annual_allowance,
  carry_forward,
  requires_document,
  status
)
values
  ('00000000-0000-4000-8000-000000000501', 'CL', 'Casual Leave', 12, false, false, 'active'),
  ('00000000-0000-4000-8000-000000000502', 'SL', 'Sick Leave', 10, false, true, 'active'),
  ('00000000-0000-4000-8000-000000000503', 'EL', 'Earned Leave', 18, true, false, 'active'),
  ('00000000-0000-4000-8000-000000000504', 'ML', 'Maternity Leave', 180, false, true, 'active')
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  annual_allowance = excluded.annual_allowance,
  carry_forward = excluded.carry_forward,
  requires_document = excluded.requires_document,
  status = excluded.status;

insert into public.holidays (id, name, date, location, holiday_type, status)
values
  ('00000000-0000-4000-8000-000000000601', 'Republic Day', '2026-01-26', 'India', 'national', 'active'),
  ('00000000-0000-4000-8000-000000000602', 'Independence Day', '2026-08-15', 'India', 'national', 'active'),
  ('00000000-0000-4000-8000-000000000603', 'Gandhi Jayanti', '2026-10-02', 'India', 'national', 'active'),
  ('00000000-0000-4000-8000-000000000604', 'Christmas', '2026-12-25', 'India', 'company', 'active')
on conflict (id) do update set
  name = excluded.name,
  date = excluded.date,
  location = excluded.location,
  holiday_type = excluded.holiday_type,
  status = excluded.status;
