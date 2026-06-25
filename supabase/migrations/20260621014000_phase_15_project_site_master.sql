create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_code text not null,
  customer_name text not null,
  contact_person text,
  email text,
  phone text,
  billing_address text,
  shipping_address text,
  city text,
  state text,
  gst_number text,
  payment_terms text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  remarks text,
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_code)
);

alter table public.projects
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists customer_id uuid references public.customers(id),
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists pincode text,
  add column if not exists latitude numeric(10, 7),
  add column if not exists longitude numeric(10, 7),
  add column if not exists geofence_radius numeric(10, 2) not null default 250,
  add column if not exists project_budget numeric(14, 2) not null default 0,
  add column if not exists project_manager_id uuid references public.user_profiles(id),
  add column if not exists primary_department_id uuid references public.departments(id),
  add column if not exists description text;

update public.projects
set organization_id = coalesce(
  organization_id,
  '00000000-0000-4000-8000-000000000101'
)
where organization_id is null;

alter table public.projects
  alter column organization_id set not null;

alter table public.project_cost_codes
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists expense_type text not null default 'Other'
    check (
      expense_type in (
        'Labour',
        'Machinery',
        'Fuel',
        'Material',
        'Travel',
        'Food',
        'Accommodation',
        'Miscellaneous',
        'Vendor Bill',
        'Other'
      )
    ),
  add column if not exists budget_allocated numeric(14, 2) not null default 0
    check (budget_allocated >= 0),
  add column if not exists responsible_department_id uuid references public.departments(id),
  add column if not exists created_by uuid references public.user_profiles(id),
  add column if not exists updated_by uuid references public.user_profiles(id);

update public.project_cost_codes cost_code
set organization_id = project.organization_id
from public.projects project
where cost_code.project_id = project.id
  and cost_code.organization_id is null;

alter table public.project_cost_codes
  alter column organization_id set not null;

alter table public.user_project_assignments
  add column if not exists created_by uuid references public.user_profiles(id),
  add column if not exists updated_by uuid references public.user_profiles(id);

create table if not exists public.department_project_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_type text not null default 'support'
    check (assignment_type in ('primary', 'support')),
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  unique (department_id, project_id, assignment_type, start_date)
);

create unique index if not exists idx_user_project_one_active_primary
on public.user_project_assignments(user_id)
where assignment_type = 'primary' and status = 'active';

create unique index if not exists idx_project_one_active_primary_department
on public.department_project_assignments(project_id)
where assignment_type = 'primary' and status = 'active';

create unique index if not exists idx_user_profiles_email_unique
on public.user_profiles(lower(email))
where email is not null and deleted_at is null;

create index if not exists idx_customers_organization
  on public.customers(organization_id, status);
create index if not exists idx_projects_organization
  on public.projects(organization_id, status);
create index if not exists idx_projects_manager
  on public.projects(project_manager_id);
create index if not exists idx_project_cost_codes_scope
  on public.project_cost_codes(organization_id, project_id, status);
create index if not exists idx_department_project_scope
  on public.department_project_assignments(
    organization_id,
    project_id,
    department_id,
    status
  );

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_department_project_assignments_updated_at
on public.department_project_assignments;
create trigger set_department_project_assignments_updated_at
before update on public.department_project_assignments
for each row execute function public.set_updated_at();

alter table public.customers enable row level security;
alter table public.department_project_assignments enable row level security;

drop policy if exists "customers visible by organization" on public.customers;
create policy "customers visible by organization"
on public.customers for select
to authenticated
using (
  organization_id = public.current_organization_id()
  or public.current_user_role() = 'super_admin'
);

drop policy if exists "customers managed by admin roles" on public.customers;
create policy "customers managed by admin roles"
on public.customers for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (
  public.current_user_role() in ('admin_hr', 'super_admin')
  and (
    organization_id = public.current_organization_id()
    or public.current_user_role() = 'super_admin'
  )
);

drop policy if exists "projects visible to authenticated users" on public.projects;
create policy "projects visible by organization and assignment"
on public.projects for select
to authenticated
using (
  deleted_at is null
  and (
    public.current_user_role() in ('admin_hr', 'super_admin', 'accounts_officer')
    or project_manager_id = auth.uid()
    or exists (
      select 1
      from public.user_project_assignments assignment
      where assignment.project_id = projects.id
        and assignment.user_id = auth.uid()
        and assignment.status = 'active'
        and (
          assignment.end_date is null
          or assignment.end_date >= current_date
        )
    )
    or exists (
      select 1
      from public.department_project_assignments assignment
      join public.user_profiles profile
        on profile.department_id = assignment.department_id
      where assignment.project_id = projects.id
        and profile.id = auth.uid()
        and public.current_user_role() = 'hod'
        and assignment.status = 'active'
    )
  )
);

drop policy if exists "projects managed by admin roles" on public.projects;
create policy "projects managed by admin roles"
on public.projects for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (
  public.current_user_role() in ('admin_hr', 'super_admin')
  and (
    organization_id = public.current_organization_id()
    or public.current_user_role() = 'super_admin'
  )
);

drop policy if exists "cost codes visible to authenticated users"
on public.project_cost_codes;
create policy "cost codes visible with project"
on public.project_cost_codes for select
to authenticated
using (
  exists (
    select 1
    from public.projects project
    where project.id = project_id
  )
);

drop policy if exists "cost codes managed by admin roles"
on public.project_cost_codes;
create policy "cost codes managed by admin roles"
on public.project_cost_codes for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (
  public.current_user_role() in ('admin_hr', 'super_admin')
  and (
    organization_id = public.current_organization_id()
    or public.current_user_role() = 'super_admin'
  )
);

drop policy if exists "department project assignments visible by organization"
on public.department_project_assignments;
create policy "department project assignments visible by organization"
on public.department_project_assignments for select
to authenticated
using (
  organization_id = public.current_organization_id()
  or public.current_user_role() = 'super_admin'
);

drop policy if exists "department project assignments managed by admin roles"
on public.department_project_assignments;
create policy "department project assignments managed by admin roles"
on public.department_project_assignments for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (
  public.current_user_role() in ('admin_hr', 'super_admin')
  and (
    organization_id = public.current_organization_id()
    or public.current_user_role() = 'super_admin'
  )
);
