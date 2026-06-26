create table if not exists public.common_cost_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  expense_type text not null default 'Other',
  customer_ids jsonb not null default '[]'::jsonb,
  expense_category_ids jsonb not null default '[]'::jsonb,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table public.project_cost_codes
  add column if not exists common_cost_code_id uuid references public.common_cost_codes(id) on delete set null;

create index if not exists idx_common_cost_codes_organization
  on public.common_cost_codes(organization_id, status);

create index if not exists idx_common_cost_codes_customer_ids
  on public.common_cost_codes using gin (customer_ids);

create index if not exists idx_common_cost_codes_expense_category_ids
  on public.common_cost_codes using gin (expense_category_ids);

create index if not exists idx_project_cost_codes_common_cost_code
  on public.project_cost_codes(common_cost_code_id);

drop trigger if exists set_common_cost_codes_updated_at on public.common_cost_codes;
create trigger set_common_cost_codes_updated_at
before update on public.common_cost_codes
for each row execute function public.set_updated_at();

alter table public.common_cost_codes enable row level security;

drop policy if exists "common cost codes visible by organization" on public.common_cost_codes;
create policy "common cost codes visible by organization"
on public.common_cost_codes for select
to authenticated
using (true);

drop policy if exists "common cost codes managed by admin roles" on public.common_cost_codes;
create policy "common cost codes managed by admin roles"
on public.common_cost_codes for all
to authenticated
using (true)
with check (true);

with ipi_org as (
  select id
  from public.organizations
  where lower(organization_name) = lower('Irrigation Products International Pvt Ltd')
     or lower(legal_name) = lower('Irrigation Products International Pvt Ltd')
     or organization_code = 'IPI'
  order by created_at
  limit 1
),
seed_customers as (
  insert into public.customers (
    organization_id,
    customer_code,
    customer_name,
    contact_person,
    city,
    state,
    payment_terms,
    status
  )
  select ipi_org.id, customer_code, customer_name, contact_person, city, state, payment_terms, 'active'
  from ipi_org
  cross join (
    values
      ('IPI-CUST-001', 'Spector Harvey Projects', 'Operations Head', 'Chennai', 'Tamil Nadu', '30 days'),
      ('IPI-CUST-002', 'Greenfield Irrigation Works', 'Project Coordinator', 'Coimbatore', 'Tamil Nadu', '45 days'),
      ('IPI-CUST-003', 'Delta Agro Infrastructure', 'Site Incharge', 'Erode', 'Tamil Nadu', '30 days')
  ) as seed(customer_code, customer_name, contact_person, city, state, payment_terms)
  on conflict (organization_id, customer_code)
  do update set
    customer_name = excluded.customer_name,
    contact_person = excluded.contact_person,
    city = excluded.city,
    state = excluded.state,
    payment_terms = excluded.payment_terms,
    status = 'active'
  returning id, organization_id, customer_code
),
ipi_customers as (
  select id, organization_id, customer_code
  from seed_customers
  union
  select customers.id, customers.organization_id, customers.customer_code
  from public.customers
  join ipi_org on ipi_org.id = customers.organization_id
  where customers.customer_code in ('IPI-CUST-001', 'IPI-CUST-002', 'IPI-CUST-003')
),
customer_map as (
  select
    organization_id,
    jsonb_agg(id::text order by customer_code) as customer_ids
  from ipi_customers
  group by organization_id
)
insert into public.common_cost_codes (
  organization_id,
  code,
  name,
  expense_type,
  customer_ids,
  expense_category_ids,
  description,
  status
)
select
  organization_id,
  'COMMON-SITE-EXP',
  'Common Site Expenses',
  'Miscellaneous',
  customer_ids,
  '["travel", "materials", "food", "misc"]'::jsonb,
  'Reusable common cost code mapped to multiple customers for common site-level claim expenses.',
  'active'
from customer_map
on conflict (organization_id, code)
do update set
  name = excluded.name,
  expense_type = excluded.expense_type,
  customer_ids = excluded.customer_ids,
  expense_category_ids = excluded.expense_category_ids,
  description = excluded.description,
  status = 'active';
