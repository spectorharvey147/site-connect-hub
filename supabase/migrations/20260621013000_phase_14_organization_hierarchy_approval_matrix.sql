create extension if not exists "pgcrypto";

alter type public.user_status add value if not exists 'suspended';

insert into public.roles (id, name, short_name, description, rank)
values (
  'hod',
  'HOD / Department Head',
  'HOD',
  'Department-level workflow approver and department data reviewer.',
  35
)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  description = excluded.description,
  rank = excluded.rank;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  organization_code text not null unique,
  organization_name text not null,
  legal_name text,
  logo_url text,
  gst_number text,
  pan_number text,
  address text,
  city text,
  state text,
  country text not null default 'India',
  pincode text,
  support_email text,
  support_phone text,
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

insert into public.organizations (
  id,
  organization_code,
  organization_name,
  legal_name,
  gst_number,
  pan_number,
  address,
  city,
  state,
  country,
  pincode,
  support_email,
  support_phone,
  currency,
  timezone,
  status
)
values (
  '00000000-0000-4000-8000-000000000101',
  'IPI',
  'IPI Site Connect',
  'IPI Site Connect Private Limited',
  '29AABCI1234F1Z5',
  'AABCI1234F',
  'Site Connect House, MG Road',
  'Bengaluru',
  'Karnataka',
  'India',
  '560001',
  'support@siteconnect.local',
  '+91 98765 00000',
  'INR',
  'Asia/Kolkata',
  'active'
)
on conflict (id) do update set
  organization_code = excluded.organization_code,
  organization_name = excluded.organization_name,
  legal_name = excluded.legal_name,
  support_email = excluded.support_email,
  support_phone = excluded.support_phone,
  updated_at = now();

alter table public.departments
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists parent_department_id uuid references public.departments(id),
  add column if not exists department_code text,
  add column if not exists department_name text,
  add column if not exists description text,
  add column if not exists hod_user_id uuid,
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id);

update public.departments
set
  organization_id = coalesce(organization_id, '00000000-0000-4000-8000-000000000101'),
  department_name = coalesce(department_name, name),
  department_code = coalesce(
    department_code,
    upper(left(regexp_replace(coalesce(name, id::text), '[^A-Za-z0-9]+', '', 'g'), 12))
  )
where organization_id is null
  or department_name is null
  or department_code is null;

alter table public.departments
  alter column organization_id set not null,
  alter column department_code set not null,
  alter column department_name set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'departments_organization_code_key'
  ) then
    alter table public.departments
      add constraint departments_organization_code_key
      unique (organization_id, department_code);
  end if;
end $$;

create table if not exists public.designations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  designation_code text not null,
  designation_name text not null,
  level_rank numeric not null default 0,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, designation_code)
);

alter table public.user_invitations
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists employee_code text,
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists designation_id uuid references public.designations(id),
  add column if not exists reporting_manager_id uuid references public.user_profiles(id),
  add column if not exists hod_user_id uuid references public.user_profiles(id),
  add column if not exists primary_project_id uuid references public.projects(id);

alter table public.user_profiles
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists employee_code text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists designation_id uuid references public.designations(id),
  add column if not exists reporting_manager_id uuid references public.user_profiles(id),
  add column if not exists hod_user_id uuid references public.user_profiles(id),
  add column if not exists primary_project_id uuid references public.projects(id),
  add column if not exists employment_type text default 'permanent'
    check (employment_type in ('permanent', 'contract', 'casual')),
  add column if not exists joining_date date,
  add column if not exists profile_photo_url text;

update public.user_profiles
set
  organization_id = coalesce(organization_id, '00000000-0000-4000-8000-000000000101'),
  employee_code = coalesce(employee_code, employee_id),
  reporting_manager_id = coalesce(reporting_manager_id, manager_id),
  profile_photo_url = coalesce(profile_photo_url, avatar_url),
  first_name = coalesce(first_name, split_part(full_name, ' ', 1)),
  last_name = coalesce(
    last_name,
    nullif(trim(replace(full_name, split_part(full_name, ' ', 1), '')), '')
  )
where organization_id is null
  or employee_code is null
  or reporting_manager_id is null
  or profile_photo_url is null
  or first_name is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_organization_employee_code_key'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_organization_employee_code_key
      unique (organization_id, employee_code);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'departments_hod_user_id_fkey'
  ) then
    alter table public.departments
      add constraint departments_hod_user_id_fkey
      foreign key (hod_user_id) references public.user_profiles(id) on delete set null;
  end if;
end $$;

create table if not exists public.user_project_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  assignment_type text not null default 'secondary'
    check (assignment_type in ('primary', 'secondary', 'temporary')),
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id, assignment_type, start_date)
);

create table if not exists public.approval_matrices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_type text not null check (
    workflow_type in (
      'claim',
      'leave',
      'material_request',
      'vendor_bill',
      'dpr',
      'attendance_correction'
    )
  ),
  department_id uuid references public.departments(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  expense_category_id uuid,
  min_amount numeric,
  max_amount numeric,
  level_1_role text,
  level_1_user_id uuid references public.user_profiles(id),
  level_2_role text,
  level_2_user_id uuid references public.user_profiles(id),
  level_3_role text,
  level_3_user_id uuid references public.user_profiles(id),
  level_4_role text,
  level_4_user_id uuid references public.user_profiles(id),
  final_approval_role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_amount is null or max_amount is null or min_amount <= max_amount)
);

create table if not exists public.approval_delegations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_user_id uuid not null references public.user_profiles(id) on delete cascade,
  delegated_to_user_id uuid not null references public.user_profiles(id) on delete cascade,
  workflow_type text,
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user_id <> delegated_to_user_id),
  check (start_date <= end_date)
);

create table if not exists public.hierarchy_change_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  old_department_id uuid references public.departments(id),
  new_department_id uuid references public.departments(id),
  old_reporting_manager_id uuid references public.user_profiles(id),
  new_reporting_manager_id uuid references public.user_profiles(id),
  old_hod_user_id uuid references public.user_profiles(id),
  new_hod_user_id uuid references public.user_profiles(id),
  change_reason text not null,
  changed_by uuid references public.user_profiles(id),
  changed_at timestamptz not null default now()
);

alter table if exists public.claims
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists requester_user_id uuid references public.user_profiles(id),
  add column if not exists reporting_manager_id uuid references public.user_profiles(id),
  add column if not exists hod_user_id uuid references public.user_profiles(id),
  add column if not exists approval_path jsonb not null default '[]'::jsonb;

alter table if exists public.claim_items
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id);

alter table if exists public.claim_attachments
  add column if not exists organization_id uuid references public.organizations(id);

alter table if exists public.claim_approvals
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id);

alter table if exists public.attendance
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists project_id uuid references public.projects(id),
  add column if not exists reporting_manager_id uuid references public.user_profiles(id),
  add column if not exists hod_user_id uuid references public.user_profiles(id);

alter table if exists public.leave_applications
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists requester_user_id uuid references public.user_profiles(id),
  add column if not exists reporting_manager_id uuid references public.user_profiles(id),
  add column if not exists hod_user_id uuid references public.user_profiles(id),
  add column if not exists approval_path jsonb not null default '[]'::jsonb;

alter table if exists public.tasks
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists project_id uuid references public.projects(id);

alter table if exists public.dpr_reports
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists requester_user_id uuid references public.user_profiles(id),
  add column if not exists reporting_manager_id uuid references public.user_profiles(id),
  add column if not exists hod_user_id uuid references public.user_profiles(id);

alter table if exists public.material_requests
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists requester_user_id uuid references public.user_profiles(id),
  add column if not exists reporting_manager_id uuid references public.user_profiles(id),
  add column if not exists hod_user_id uuid references public.user_profiles(id);

alter table if exists public.vendor_bills
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists project_id uuid references public.projects(id),
  add column if not exists reporting_manager_id uuid references public.user_profiles(id),
  add column if not exists hod_user_id uuid references public.user_profiles(id);

alter table if exists public.payment_vouchers
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists project_id uuid references public.projects(id);

alter table if exists public.employee_ledgers
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists project_id uuid references public.projects(id);

alter table if exists public.vendor_ledgers
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists project_id uuid references public.projects(id);

alter table if exists public.transactions
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists project_id uuid references public.projects(id);

alter table if exists public.notifications
  add column if not exists organization_id uuid references public.organizations(id);

alter table if exists public.audit_logs
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists actor_user_id uuid references public.user_profiles(id);

create index if not exists idx_organizations_status on public.organizations(status);
create index if not exists idx_departments_organization_id on public.departments(organization_id);
create index if not exists idx_departments_parent on public.departments(parent_department_id);
create index if not exists idx_departments_hod on public.departments(hod_user_id);
create index if not exists idx_designations_organization_id on public.designations(organization_id);
create index if not exists idx_user_profiles_organization_id on public.user_profiles(organization_id);
create index if not exists idx_user_profiles_department_id on public.user_profiles(department_id);
create index if not exists idx_user_profiles_reporting_manager_id on public.user_profiles(reporting_manager_id);
create index if not exists idx_user_profiles_hod_user_id on public.user_profiles(hod_user_id);
create index if not exists idx_user_project_assignments_user_id on public.user_project_assignments(user_id);
create index if not exists idx_approval_matrices_scope on public.approval_matrices(
  organization_id,
  workflow_type,
  department_id,
  project_id,
  expense_category_id
);
create index if not exists idx_approval_delegations_active on public.approval_delegations(
  organization_id,
  from_user_id,
  workflow_type,
  status,
  start_date,
  end_date
);
create index if not exists idx_claims_hierarchy_scope on public.claims(
  organization_id,
  department_id,
  reporting_manager_id,
  hod_user_id
);
create index if not exists idx_attendance_hierarchy_scope on public.attendance(
  organization_id,
  department_id,
  project_id,
  reporting_manager_id,
  hod_user_id
);
create index if not exists idx_leave_applications_hierarchy_scope
  on public.leave_applications(
    organization_id,
    department_id,
    reporting_manager_id,
    hod_user_id
  );
create index if not exists idx_tasks_hierarchy_scope on public.tasks(
  organization_id,
  department_id,
  project_id
);
create index if not exists idx_claim_attachments_organization_id
  on public.claim_attachments(organization_id);
create index if not exists idx_employee_ledgers_hierarchy_scope
  on public.employee_ledgers(organization_id, department_id, project_id);
create index if not exists idx_transactions_hierarchy_scope
  on public.transactions(organization_id, department_id, project_id);

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists set_designations_updated_at on public.designations;
create trigger set_designations_updated_at
before update on public.designations
for each row execute function public.set_updated_at();

drop trigger if exists set_user_project_assignments_updated_at on public.user_project_assignments;
create trigger set_user_project_assignments_updated_at
before update on public.user_project_assignments
for each row execute function public.set_updated_at();

drop trigger if exists set_approval_matrices_updated_at on public.approval_matrices;
create trigger set_approval_matrices_updated_at
before update on public.approval_matrices
for each row execute function public.set_updated_at();

drop trigger if exists set_approval_delegations_updated_at on public.approval_delegations;
create trigger set_approval_delegations_updated_at
before update on public.approval_delegations
for each row execute function public.set_updated_at();

create or replace function public.current_organization_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select organization_id
  from public.user_profiles
  where id = auth.uid()
  limit 1
$$;

grant execute on function public.current_organization_id() to authenticated;

alter table public.organizations enable row level security;
alter table public.designations enable row level security;
alter table public.user_project_assignments enable row level security;
alter table public.approval_matrices enable row level security;
alter table public.approval_delegations enable row level security;
alter table public.hierarchy_change_logs enable row level security;

drop policy if exists "organizations visible by membership" on public.organizations;
create policy "organizations visible by membership"
on public.organizations for select
to authenticated
using (id = public.current_organization_id() or public.current_user_role() = 'super_admin');

drop policy if exists "organizations managed by super admin" on public.organizations;
create policy "organizations managed by super admin"
on public.organizations for all
to authenticated
using (public.current_user_role() = 'super_admin')
with check (public.current_user_role() = 'super_admin');

drop policy if exists "designations visible by organization" on public.designations;
create policy "designations visible by organization"
on public.designations for select
to authenticated
using (
  organization_id = public.current_organization_id()
  or public.current_user_role() = 'super_admin'
);

drop policy if exists "designations managed by admin roles" on public.designations;
create policy "designations managed by admin roles"
on public.designations for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "user project assignments visible by organization" on public.user_project_assignments;
create policy "user project assignments visible by organization"
on public.user_project_assignments for select
to authenticated
using (
  organization_id = public.current_organization_id()
  or public.current_user_role() = 'super_admin'
);

drop policy if exists "user project assignments managed by admin roles" on public.user_project_assignments;
create policy "user project assignments managed by admin roles"
on public.user_project_assignments for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "approval matrices visible by organization" on public.approval_matrices;
create policy "approval matrices visible by organization"
on public.approval_matrices for select
to authenticated
using (
  organization_id = public.current_organization_id()
  or public.current_user_role() = 'super_admin'
);

drop policy if exists "approval matrices managed by admin roles" on public.approval_matrices;
create policy "approval matrices managed by admin roles"
on public.approval_matrices for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "approval delegations visible by organization" on public.approval_delegations;
create policy "approval delegations visible by organization"
on public.approval_delegations for select
to authenticated
using (
  organization_id = public.current_organization_id()
  or public.current_user_role() = 'super_admin'
);

drop policy if exists "approval delegations managed by admin roles" on public.approval_delegations;
create policy "approval delegations managed by admin roles"
on public.approval_delegations for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "hierarchy logs visible by admin roles" on public.hierarchy_change_logs;
create policy "hierarchy logs visible by admin roles"
on public.hierarchy_change_logs for select
to authenticated
using (
  public.current_user_role() in ('admin_hr', 'super_admin')
  or organization_id = public.current_organization_id()
);

drop policy if exists "hierarchy logs inserted by admin roles" on public.hierarchy_change_logs;
create policy "hierarchy logs inserted by admin roles"
on public.hierarchy_change_logs for insert
to authenticated
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "claims visible by ownership or role" on public.claims;
create policy "claims visible by ownership or role"
on public.claims for select
to authenticated
using (
  deleted_at is null
  and (
    user_id = auth.uid()
    or requester_user_id = auth.uid()
    or reporting_manager_id = auth.uid()
    or hod_user_id = auth.uid()
    or public.current_user_role() in ('admin_hr', 'accounts_officer', 'super_admin')
  )
);

drop policy if exists "claims updated by owner or workflow roles" on public.claims;
create policy "claims updated by owner or workflow roles"
on public.claims for update
to authenticated
using (
  user_id = auth.uid()
  or requester_user_id = auth.uid()
  or reporting_manager_id = auth.uid()
  or hod_user_id = auth.uid()
  or public.current_user_role() in ('admin_hr', 'accounts_officer', 'super_admin')
)
with check (
  user_id = auth.uid()
  or requester_user_id = auth.uid()
  or reporting_manager_id = auth.uid()
  or hod_user_id = auth.uid()
  or public.current_user_role() in ('admin_hr', 'accounts_officer', 'super_admin')
);

drop policy if exists "claim child rows visible with claim" on public.claim_items;
create policy "claim child rows visible with claim"
on public.claim_items for select
to authenticated
using (
  exists (
    select 1
    from public.claims c
    where c.id = claim_id
      and c.deleted_at is null
      and (
        c.user_id = auth.uid()
        or c.requester_user_id = auth.uid()
        or c.reporting_manager_id = auth.uid()
        or c.hod_user_id = auth.uid()
        or public.current_user_role() in (
          'admin_hr',
          'accounts_officer',
          'super_admin'
        )
      )
  )
);

drop policy if exists "claim attachments visible with claim" on public.claim_attachments;
create policy "claim attachments visible with claim"
on public.claim_attachments for select
to authenticated
using (
  exists (
    select 1
    from public.claims c
    where c.id = claim_id
      and c.deleted_at is null
      and (
        c.user_id = auth.uid()
        or c.requester_user_id = auth.uid()
        or c.reporting_manager_id = auth.uid()
        or c.hod_user_id = auth.uid()
        or public.current_user_role() in (
          'admin_hr',
          'accounts_officer',
          'super_admin'
        )
      )
  )
);

drop policy if exists "claim approvals visible with claim" on public.claim_approvals;
create policy "claim approvals visible with claim"
on public.claim_approvals for select
to authenticated
using (
  exists (
    select 1
    from public.claims c
    where c.id = claim_id
      and c.deleted_at is null
      and (
        c.user_id = auth.uid()
        or c.requester_user_id = auth.uid()
        or c.reporting_manager_id = auth.uid()
        or c.hod_user_id = auth.uid()
        or public.current_user_role() in (
          'admin_hr',
          'accounts_officer',
          'super_admin'
        )
      )
  )
);

drop policy if exists "claim approvals inserted by workflow roles" on public.claim_approvals;
create policy "claim approvals inserted by workflow roles"
on public.claim_approvals for insert
to authenticated
with check (
  actor_id = auth.uid()
  and public.current_user_role() in (
    'site_staff',
    'manager',
    'hod',
    'admin_hr',
    'accounts_officer',
    'super_admin'
  )
);

drop policy if exists "ledger inserted by workflow roles" on public.employee_ledgers;
create policy "ledger inserted by workflow roles"
on public.employee_ledgers for insert
to authenticated
with check (
  public.current_user_role() in (
    'hod',
    'accounts_officer',
    'super_admin'
  )
);

drop policy if exists "transactions visible by owner or finance roles" on public.transactions;
create policy "transactions visible by owner or finance roles"
on public.transactions for select
to authenticated
using (
  user_id = auth.uid()
  or actor_id = auth.uid()
  or public.current_user_role() in ('admin_hr', 'accounts_officer', 'super_admin')
);

drop policy if exists "transactions inserted by workflow roles" on public.transactions;
create policy "transactions inserted by workflow roles"
on public.transactions for insert
to authenticated
with check (
  actor_id = auth.uid()
  and public.current_user_role() in (
    'site_staff',
    'manager',
    'hod',
    'admin_hr',
    'accounts_officer',
    'super_admin'
  )
);

drop policy if exists "attendance visible by owner or role" on public.attendance;
create policy "attendance visible by owner or role"
on public.attendance for select
to authenticated
using (
  deleted_at is null
  and (
    user_id = auth.uid()
    or reporting_manager_id = auth.uid()
    or hod_user_id = auth.uid()
    or public.current_user_role() in ('admin_hr', 'super_admin')
    or (
      public.current_user_role() = 'manager'
      and organization_id = public.current_organization_id()
    )
    or (
      public.current_user_role() = 'hod'
      and department_id in (
        select department_id
        from public.user_profiles
        where id = auth.uid()
      )
    )
  )
);

drop policy if exists "leave visible by owner or role" on public.leave_applications;
create policy "leave visible by owner or role"
on public.leave_applications for select
to authenticated
using (
  deleted_at is null
  and (
    user_id = auth.uid()
    or requester_user_id = auth.uid()
    or manager_id = auth.uid()
    or reporting_manager_id = auth.uid()
    or hod_user_id = auth.uid()
    or public.current_user_role() in ('admin_hr', 'super_admin')
    or (
      public.current_user_role() = 'manager'
      and organization_id = public.current_organization_id()
    )
    or (
      public.current_user_role() = 'hod'
      and department_id in (
        select department_id
        from public.user_profiles
        where id = auth.uid()
      )
    )
  )
);

drop policy if exists "leave updated by owner manager or admin" on public.leave_applications;
create policy "leave updated by owner manager or admin"
on public.leave_applications for update
to authenticated
using (
  user_id = auth.uid()
  or manager_id = auth.uid()
  or reporting_manager_id = auth.uid()
  or hod_user_id = auth.uid()
  or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
)
with check (
  user_id = auth.uid()
  or manager_id = auth.uid()
  or reporting_manager_id = auth.uid()
  or hod_user_id = auth.uid()
  or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
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
      and l.deleted_at is null
      and (
        l.user_id = auth.uid()
        or l.requester_user_id = auth.uid()
        or l.manager_id = auth.uid()
        or l.reporting_manager_id = auth.uid()
        or l.hod_user_id = auth.uid()
        or public.current_user_role() in (
          'manager',
          'hod',
          'admin_hr',
          'super_admin'
        )
      )
  )
);

drop policy if exists "leave history visible with leave" on public.leave_approval_history;
create policy "leave history visible with leave"
on public.leave_approval_history for select
to authenticated
using (
  exists (
    select 1
    from public.leave_applications l
    where l.id = leave_id
      and l.deleted_at is null
      and (
        l.user_id = auth.uid()
        or l.requester_user_id = auth.uid()
        or l.manager_id = auth.uid()
        or l.reporting_manager_id = auth.uid()
        or l.hod_user_id = auth.uid()
        or public.current_user_role() in (
          'manager',
          'hod',
          'admin_hr',
          'super_admin'
        )
      )
  )
);

drop policy if exists "tasks visible by owner assignee manager or admin" on public.tasks;
create policy "tasks visible by owner assignee manager or admin"
on public.tasks for select
to authenticated
using (
  deleted_at is null
  and (
    assigned_to = auth.uid()
    or created_by = auth.uid()
    or public.current_user_role() in ('admin_hr', 'super_admin')
    or (
      public.current_user_role() in ('manager', 'hod')
      and organization_id = public.current_organization_id()
    )
  )
);

drop policy if exists "tasks created by manager or admin roles" on public.tasks;
create policy "tasks created by manager or admin roles"
on public.tasks for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
);

drop policy if exists "tasks updated by participants or admin roles" on public.tasks;
create policy "tasks updated by participants or admin roles"
on public.tasks for update
to authenticated
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
)
with check (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
);

drop policy if exists "task comments visible with task" on public.task_comments;
create policy "task comments visible with task"
on public.task_comments for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.deleted_at is null
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or public.current_user_role() in (
          'manager',
          'hod',
          'admin_hr',
          'super_admin'
        )
      )
  )
);

drop policy if exists "task comments inserted by visible users" on public.task_comments;
create policy "task comments inserted by visible users"
on public.task_comments for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.deleted_at is null
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or public.current_user_role() in (
          'manager',
          'hod',
          'admin_hr',
          'super_admin'
        )
      )
  )
);

drop policy if exists "task attachments visible with task" on public.task_attachments;
create policy "task attachments visible with task"
on public.task_attachments for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.deleted_at is null
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or public.current_user_role() in (
          'manager',
          'hod',
          'admin_hr',
          'super_admin'
        )
      )
  )
);

drop policy if exists "task attachments inserted by visible users" on public.task_attachments;
create policy "task attachments inserted by visible users"
on public.task_attachments for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.deleted_at is null
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or public.current_user_role() in (
          'manager',
          'hod',
          'admin_hr',
          'super_admin'
        )
      )
  )
);

drop policy if exists "task activity visible with task" on public.task_activity;
create policy "task activity visible with task"
on public.task_activity for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.deleted_at is null
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or public.current_user_role() in (
          'manager',
          'hod',
          'admin_hr',
          'super_admin'
        )
      )
  )
);

insert into storage.buckets (id, name, public)
values
  ('organization-logos', 'organization-logos', true),
  ('claim-attachments', 'claim-attachments', false),
  ('leave-documents', 'leave-documents', false),
  ('dpr-photos', 'dpr-photos', false),
  ('task-attachments', 'task-attachments', false),
  ('message-attachments', 'message-attachments', false),
  ('vendor-bills', 'vendor-bills', false),
  ('material-documents', 'material-documents', false),
  ('fuel-receipts', 'fuel-receipts', false),
  ('profile-photos', 'profile-photos', false)
on conflict (id) do update set
  public = excluded.public;
