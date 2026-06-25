do $$
begin
  create type public.attendance_status as enum (
    'present',
    'absent',
    'late',
    'half_day',
    'on_leave',
    'holiday',
    'work_from_home',
    'comp_off'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  grace_minutes int not null default 15,
  half_day_hours numeric(5, 2) not null default 4,
  full_day_hours numeric(5, 2) not null default 8,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  project_id uuid references public.projects(id),
  shift_id uuid references public.shifts(id),
  date date not null,
  check_in_time time,
  check_out_time time,
  status public.attendance_status not null,
  location_lat numeric(9, 6),
  location_lon numeric(9, 6),
  location_accuracy int,
  checkout_location_lat numeric(9, 6),
  checkout_location_lon numeric(9, 6),
  checkout_location_accuracy int,
  worked_hours numeric(5, 2) not null default 0,
  remarks text,
  approved_by uuid references public.user_profiles(id),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, date)
);

create index if not exists idx_attendance_user_id on public.attendance(user_id);
create index if not exists idx_attendance_project_id on public.attendance(project_id);
create index if not exists idx_attendance_status on public.attendance(status);
create index if not exists idx_attendance_date on public.attendance(date);
create index if not exists idx_attendance_created_at on public.attendance(created_at);
create index if not exists idx_shifts_status on public.shifts(status);

drop trigger if exists set_shifts_updated_at on public.shifts;
create trigger set_shifts_updated_at
before update on public.shifts
for each row execute function public.set_updated_at();

drop trigger if exists set_attendance_updated_at on public.attendance;
create trigger set_attendance_updated_at
before update on public.attendance
for each row execute function public.set_updated_at();

alter table public.shifts enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "shifts visible to authenticated users" on public.shifts;
create policy "shifts visible to authenticated users"
on public.shifts for select
to authenticated
using (status = 'active');

drop policy if exists "shifts managed by admin roles" on public.shifts;
create policy "shifts managed by admin roles"
on public.shifts for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "attendance visible by owner or role" on public.attendance;
create policy "attendance visible by owner or role"
on public.attendance for select
to authenticated
using (
  deleted_at is null
  and (
    user_id = auth.uid()
    or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "users create own attendance" on public.attendance;
create policy "users create own attendance"
on public.attendance for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.current_user_role() in ('admin_hr', 'super_admin')
);

drop policy if exists "attendance updated by owner or admin roles" on public.attendance;
create policy "attendance updated by owner or admin roles"
on public.attendance for update
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('admin_hr', 'super_admin')
)
with check (
  user_id = auth.uid()
  or public.current_user_role() in ('admin_hr', 'super_admin')
);

insert into public.shifts (
  id,
  name,
  start_time,
  end_time,
  grace_minutes,
  half_day_hours,
  full_day_hours,
  status
)
values
  (
    '00000000-0000-4000-8000-000000000401',
    'General Shift',
    '09:00',
    '18:00',
    15,
    4,
    8,
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000402',
    'Early Site Shift',
    '07:00',
    '16:00',
    10,
    4,
    8,
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000403',
    'Night Shift',
    '20:00',
    '05:00',
    15,
    4,
    8,
    'active'
  )
on conflict (id) do update set
  name = excluded.name,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  grace_minutes = excluded.grace_minutes,
  half_day_hours = excluded.half_day_hours,
  full_day_hours = excluded.full_day_hours,
  status = excluded.status;
