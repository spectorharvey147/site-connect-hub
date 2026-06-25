do $$
begin
  create type public.dpr_status as enum (
    'draft',
    'submitted',
    'reviewed',
    'returned'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.dpr_issue_severity as enum (
    'low',
    'medium',
    'high'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.dpr_issue_status as enum (
    'resolved',
    'pending'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.daily_progress_reports (
  id uuid primary key default gen_random_uuid(),
  dpr_number text not null unique,
  project_id uuid not null references public.projects(id),
  report_date date not null,
  shift_id text,
  shift_name text,
  submitted_by uuid not null references public.user_profiles(id),
  weather text[] not null default '{}',
  next_day_plan text,
  planned_manpower int not null default 0,
  planned_equipment text,
  status public.dpr_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_by uuid references public.user_profiles(id),
  reviewed_at timestamptz,
  review_comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.dpr_activities (
  id uuid primary key default gen_random_uuid(),
  dpr_id uuid not null references public.daily_progress_reports(id) on delete cascade,
  activity_name text not null,
  custom_activity_name text,
  description text not null,
  completion_percent int not null default 0 check (completion_percent between 0 and 100),
  machines_used text[] not null default '{}',
  male_labor int not null default 0,
  female_labor int not null default 0,
  supervisors int not null default 0,
  company_staff int not null default 0,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dpr_issues (
  id uuid primary key default gen_random_uuid(),
  dpr_id uuid not null references public.daily_progress_reports(id) on delete cascade,
  issue_type text not null,
  severity public.dpr_issue_severity not null default 'medium',
  description text not null,
  resolution_notes text,
  status public.dpr_issue_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dpr_photos (
  id uuid primary key default gen_random_uuid(),
  dpr_id uuid not null references public.daily_progress_reports(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text,
  file_size int,
  caption text,
  uploaded_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_dpr_project_id on public.daily_progress_reports(project_id);
create index if not exists idx_dpr_submitted_by on public.daily_progress_reports(submitted_by);
create index if not exists idx_dpr_report_date on public.daily_progress_reports(report_date);
create index if not exists idx_dpr_status on public.daily_progress_reports(status);
create unique index if not exists idx_dpr_unique_submitted_day
on public.daily_progress_reports(submitted_by, project_id, report_date)
where deleted_at is null and status <> 'draft';
create index if not exists idx_dpr_activities_dpr_id on public.dpr_activities(dpr_id);
create index if not exists idx_dpr_issues_dpr_id on public.dpr_issues(dpr_id);
create index if not exists idx_dpr_issues_status on public.dpr_issues(status);
create index if not exists idx_dpr_photos_dpr_id on public.dpr_photos(dpr_id);

drop trigger if exists set_daily_progress_reports_updated_at on public.daily_progress_reports;
create trigger set_daily_progress_reports_updated_at
before update on public.daily_progress_reports
for each row execute function public.set_updated_at();

drop trigger if exists set_dpr_activities_updated_at on public.dpr_activities;
create trigger set_dpr_activities_updated_at
before update on public.dpr_activities
for each row execute function public.set_updated_at();

drop trigger if exists set_dpr_issues_updated_at on public.dpr_issues;
create trigger set_dpr_issues_updated_at
before update on public.dpr_issues
for each row execute function public.set_updated_at();

alter table public.daily_progress_reports enable row level security;
alter table public.dpr_activities enable row level security;
alter table public.dpr_issues enable row level security;
alter table public.dpr_photos enable row level security;

drop policy if exists "dpr visible to owner manager or admin" on public.daily_progress_reports;
create policy "dpr visible to owner manager or admin"
on public.daily_progress_reports for select
to authenticated
using (
  deleted_at is null
  and (
    submitted_by = auth.uid()
    or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "dpr created by field roles" on public.daily_progress_reports;
create policy "dpr created by field roles"
on public.daily_progress_reports for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin')
);

drop policy if exists "dpr updated by owner manager or admin" on public.daily_progress_reports;
create policy "dpr updated by owner manager or admin"
on public.daily_progress_reports for update
to authenticated
using (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
)
with check (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
);

drop policy if exists "dpr activities visible with dpr" on public.dpr_activities;
create policy "dpr activities visible with dpr"
on public.dpr_activities for select
to authenticated
using (
  exists (
    select 1
    from public.daily_progress_reports d
    where d.id = dpr_id
      and d.deleted_at is null
      and (
        d.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "dpr activities inserted with own dpr" on public.dpr_activities;
create policy "dpr activities inserted with own dpr"
on public.dpr_activities for insert
to authenticated
with check (
  exists (
    select 1
    from public.daily_progress_reports d
    where d.id = dpr_id
      and (
        d.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "dpr issues visible with dpr" on public.dpr_issues;
create policy "dpr issues visible with dpr"
on public.dpr_issues for select
to authenticated
using (
  exists (
    select 1
    from public.daily_progress_reports d
    where d.id = dpr_id
      and d.deleted_at is null
      and (
        d.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "dpr issues inserted with own dpr" on public.dpr_issues;
create policy "dpr issues inserted with own dpr"
on public.dpr_issues for insert
to authenticated
with check (
  exists (
    select 1
    from public.daily_progress_reports d
    where d.id = dpr_id
      and (
        d.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "dpr photos visible with dpr" on public.dpr_photos;
create policy "dpr photos visible with dpr"
on public.dpr_photos for select
to authenticated
using (
  exists (
    select 1
    from public.daily_progress_reports d
    where d.id = dpr_id
      and d.deleted_at is null
      and (
        d.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "dpr photos inserted by uploader" on public.dpr_photos;
create policy "dpr photos inserted by uploader"
on public.dpr_photos for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.daily_progress_reports d
    where d.id = dpr_id
      and (
        d.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);
