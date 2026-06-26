alter table public.projects
  add column if not exists is_common_project boolean not null default false;

alter table public.project_cost_codes
  add column if not exists code_type text not null default 'unique'
    check (code_type in ('unique', 'common'));

alter table public.claims
  add column if not exists customer_id uuid references public.customers(id),
  add column if not exists customer_name text;

create index if not exists idx_projects_common_project
  on public.projects(organization_id, is_common_project, status);

create index if not exists idx_claims_customer_id
  on public.claims(customer_id);

with ipi_org as (
  select id
  from public.organizations
  where organization_code = 'IPI'
     or lower(organization_name) = lower('Irrigation Products International Pvt Ltd')
     or lower(legal_name) = lower('Irrigation Products International Pvt Ltd')
  order by created_at
  limit 1
),
seed_department as (
  insert into public.departments (
    organization_id,
    name,
    department_code,
    department_name,
    status
  )
  select
    id,
    'Irrigation Common Project',
    'IRR-COMMON',
    'Irrigation Common Project',
    'active'
  from ipi_org
  on conflict (organization_id, department_code)
  do update set
    name = excluded.name,
    department_name = excluded.department_name,
    status = 'active'
  returning id, organization_id
),
department_row as (
  select id, organization_id from seed_department
  union
  select d.id, d.organization_id
  from public.departments d
  join ipi_org on ipi_org.id = d.organization_id
  where d.department_code = 'IRR-COMMON'
  limit 1
),
project_row as (
  insert into public.projects (
    organization_id,
    code,
    name,
    primary_department_id,
    is_common_project,
    location,
    geofence_radius,
    project_budget,
    status
  )
  select
    organization_id,
    'IRR-COMMON-PROJ',
    'Irrigation Common Project',
    id,
    true,
    'Common customer claims',
    250,
    0,
    'active'
  from department_row
  on conflict (organization_id, code)
  do update set
    name = excluded.name,
    primary_department_id = excluded.primary_department_id,
    is_common_project = true,
    status = 'active'
  returning id, organization_id, primary_department_id
)
insert into public.project_cost_codes (
  organization_id,
  project_id,
  common_cost_code_id,
  code,
  name,
  expense_type,
  code_type,
  customer_ids,
  expense_category_ids,
  description,
  budget_allocated,
  responsible_department_id,
  status
)
select
  project_row.organization_id,
  project_row.id,
  common_cost_codes.id,
  common_cost_codes.code,
  common_cost_codes.name,
  common_cost_codes.expense_type,
  'common',
  common_cost_codes.customer_ids,
  common_cost_codes.expense_category_ids,
  'Common customer claim code under Irrigation Common Project.',
  50000,
  project_row.primary_department_id,
  'active'
from project_row
join public.common_cost_codes
  on common_cost_codes.organization_id = project_row.organization_id
 and common_cost_codes.code = 'COMMON-SITE-EXP'
on conflict (project_id, code)
do update set
  common_cost_code_id = excluded.common_cost_code_id,
  code_type = 'common',
  customer_ids = excluded.customer_ids,
  expense_category_ids = excluded.expense_category_ids,
  status = 'active';
