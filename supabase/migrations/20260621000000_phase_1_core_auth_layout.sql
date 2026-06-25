create extension if not exists "pgcrypto";

do $$
begin
  create type public.user_status as enum ('active', 'inactive', 'invited', 'locked');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.roles (
  id text primary key,
  name text not null,
  short_name text not null,
  description text,
  rank int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id text not null unique,
  full_name text not null,
  phone text,
  role_id text not null references public.roles(id),
  manager_id uuid references public.user_profiles(id),
  department text,
  avatar_url text,
  status public.user_status not null default 'active',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  company_logo_url text,
  support_email text,
  support_phone text,
  website text,
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  require_admin_verification_claims boolean not null default true,
  require_manager_approval_claims boolean not null default true,
  require_super_admin_approval_claims boolean not null default true,
  require_manager_approval_leave boolean not null default true,
  email_notifications_enabled boolean not null default true,
  app_notifications_enabled boolean not null default true,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  customer_name text,
  location text,
  status text not null default 'active',
  start_date date,
  end_date date,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.project_cost_codes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  related_id uuid,
  related_type text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_role_id on public.user_profiles(role_id);
create index if not exists idx_user_profiles_manager_id on public.user_profiles(manager_id);
create index if not exists idx_user_profiles_status on public.user_profiles(status);
create index if not exists idx_app_sessions_user_id on public.app_sessions(user_id);
create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_project_cost_codes_project_id on public.project_cost_codes(project_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_read_at on public.notifications(read_at);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_departments_updated_at on public.departments;
create trigger set_departments_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_company_settings_updated_at on public.company_settings;
create trigger set_company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_project_cost_codes_updated_at on public.project_cost_codes;
create trigger set_project_cost_codes_updated_at
before update on public.project_cost_codes
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role_id
  from public.user_profiles
  where id = auth.uid()
  limit 1
$$;

grant execute on function public.current_user_role() to authenticated;

alter table public.roles enable row level security;
alter table public.departments enable row level security;
alter table public.user_profiles enable row level security;
alter table public.app_sessions enable row level security;
alter table public.company_settings enable row level security;
alter table public.projects enable row level security;
alter table public.project_cost_codes enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "roles are visible to authenticated users" on public.roles;
create policy "roles are visible to authenticated users"
on public.roles for select
to authenticated
using (true);

drop policy if exists "departments are visible to authenticated users" on public.departments;
create policy "departments are visible to authenticated users"
on public.departments for select
to authenticated
using (true);

drop policy if exists "departments are managed by admin roles" on public.departments;
create policy "departments are managed by admin roles"
on public.departments for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "profiles are visible by role" on public.user_profiles;
create policy "profiles are visible by role"
on public.user_profiles for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'accounts_officer', 'super_admin')
);

drop policy if exists "users can update their own profile" on public.user_profiles;
create policy "users can update their own profile"
on public.user_profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "admin roles manage profiles" on public.user_profiles;
create policy "admin roles manage profiles"
on public.user_profiles for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "users read own sessions" on public.app_sessions;
create policy "users read own sessions"
on public.app_sessions for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users create own sessions" on public.app_sessions;
create policy "users create own sessions"
on public.app_sessions for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "company settings visible to authenticated users" on public.company_settings;
create policy "company settings visible to authenticated users"
on public.company_settings for select
to authenticated
using (true);

drop policy if exists "company settings managed by super admin" on public.company_settings;
create policy "company settings managed by super admin"
on public.company_settings for all
to authenticated
using (public.current_user_role() = 'super_admin')
with check (public.current_user_role() = 'super_admin');

drop policy if exists "projects visible to authenticated users" on public.projects;
create policy "projects visible to authenticated users"
on public.projects for select
to authenticated
using (deleted_at is null);

drop policy if exists "projects managed by admin roles" on public.projects;
create policy "projects managed by admin roles"
on public.projects for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "cost codes visible to authenticated users" on public.project_cost_codes;
create policy "cost codes visible to authenticated users"
on public.project_cost_codes for select
to authenticated
using (true);

drop policy if exists "cost codes managed by admin roles" on public.project_cost_codes;
create policy "cost codes managed by admin roles"
on public.project_cost_codes for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "authenticated users create audit logs" on public.audit_logs;
create policy "authenticated users create audit logs"
on public.audit_logs for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "audit logs visible to admin roles" on public.audit_logs;
create policy "audit logs visible to admin roles"
on public.audit_logs for select
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'));

insert into public.roles (id, name, short_name, description, rank)
values
  ('site_staff', 'Site Staff / User', 'User', 'Submit attendance, claims, leave and field updates.', 10),
  ('manager', 'Manager', 'Manager', 'Approve team workflows and monitor project execution.', 30),
  ('admin_hr', 'Admin / HR', 'Admin', 'Verify claims, manage users and maintain master data.', 40),
  ('accounts_officer', 'Accounts Officer', 'Accounts', 'Generate vouchers, process payments and maintain ledgers.', 50),
  ('super_admin', 'Super Admin / Finance Head', 'Super Admin', 'Final approvals, finance oversight and system configuration.', 100)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  description = excluded.description,
  rank = excluded.rank;
