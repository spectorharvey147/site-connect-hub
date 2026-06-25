-- Complete normalized source, stock, contract and billing records that were
-- still missing from the production schema. Existing module tables remain the
-- canonical headers; these tables hold the linked detail and ledger records.

alter type public.fuel_source add value if not exists 'credit';

alter table public.vendor_bills
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists cost_code_id uuid references public.project_cost_codes(id),
  add column if not exists contract_id uuid references public.vendor_contracts(id),
  add column if not exists previous_advance numeric(14,2) not null default 0,
  add column if not exists tds_amount numeric(14,2) not null default 0,
  add column if not exists other_deduction numeric(14,2) not null default 0,
  add column if not exists paid_amount numeric(14,2) not null default 0,
  add column if not exists outstanding_amount numeric(14,2) not null default 0,
  add column if not exists created_by uuid references public.user_profiles(id);

update public.vendor_bills bill
set organization_id = project.organization_id,
    created_by = coalesce(bill.created_by, bill.submitted_by),
    outstanding_amount = greatest(bill.total_amount - bill.paid_amount, 0)
from public.projects project
where project.id = bill.project_id
  and (bill.organization_id is null or bill.created_by is null);

create table if not exists public.vendor_contract_rate_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.vendor_contracts(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  rate_code text not null,
  description text not null,
  unit text not null,
  rate numeric(14,2) not null default 0,
  overtime_rate numeric(14,2) not null default 0,
  status text not null default 'active',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, rate_code)
);

create table if not exists public.labour_contract_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null unique references public.vendor_contracts(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text references public.vendors(id),
  contract_mode text not null check (contract_mode in (
    'contractor_labour','fixed_individual_labour','local_labour_incharge','direct_individual_payment'
  )),
  standard_start_time time,
  standard_end_time time,
  standard_hours numeric(6,2) not null default 8,
  ot_after_hours numeric(6,2) not null default 8,
  weekly_off_rule text,
  food_allowance numeric(14,2) not null default 0,
  transport_allowance numeric(14,2) not null default 0,
  incharge_name text,
  incharge_phone text,
  incharge_payment_mode text,
  status text not null default 'active',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.labour_payees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  contract_id uuid references public.vendor_contracts(id) on delete cascade,
  vendor_id text references public.vendors(id),
  payee_type text not null check (payee_type in ('vendor','incharge','individual')),
  payee_name text not null,
  phone text,
  payment_details text,
  status text not null default 'active',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.casual_labour_work_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text references public.vendors(id),
  contract_id uuid references public.vendor_contracts(id),
  allocation_date date not null,
  work_area text not null,
  work_description text not null,
  male_count int not null default 0,
  female_count int not null default 0,
  supervisor_count int not null default 0,
  skilled_count int not null default 0,
  unskilled_count int not null default 0,
  remarks text,
  status text not null default 'submitted',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.casual_labour_bills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text references public.vendors(id),
  contract_id uuid references public.vendor_contracts(id),
  vendor_bill_id uuid references public.vendor_bills(id),
  period_from date not null,
  period_to date not null,
  normal_amount numeric(14,2) not null default 0,
  overtime_amount numeric(14,2) not null default 0,
  allowance_amount numeric(14,2) not null default 0,
  deduction_amount numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  status text not null default 'draft',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machinery_contract_machines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  contract_id uuid not null references public.vendor_contracts(id) on delete cascade,
  vendor_id text references public.vendors(id),
  machine_type text not null,
  machine_number text not null,
  registration_number text,
  billing_type text not null check (billing_type in ('monthly','weekly','daily','hourly','per_trip')),
  monthly_rate numeric(14,2) not null default 0,
  weekly_rate numeric(14,2) not null default 0,
  daily_rate numeric(14,2) not null default 0,
  hourly_rate numeric(14,2) not null default 0,
  trip_rate numeric(14,2) not null default 0,
  ot_rate_per_hour numeric(14,2) not null default 0,
  status text not null default 'active',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, machine_number)
);

create table if not exists public.machine_breakdowns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  vendor_id text references public.vendors(id),
  machine_log_id uuid not null references public.machine_logs(id) on delete cascade,
  breakdown_start timestamptz not null,
  breakdown_end timestamptz,
  duration_hours numeric(8,2) not null default 0,
  reason text not null,
  resolution text,
  deduction_amount numeric(14,2) not null default 0,
  status text not null default 'open',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text not null references public.vendors(id),
  vendor_contract_id uuid references public.vendor_contracts(id),
  contract_code text not null,
  fuel_type text not null,
  rate_type text not null check (rate_type in ('fixed','market','slip_based')),
  fixed_rate_per_unit numeric(14,2),
  unit text not null default 'L',
  credit_limit numeric(14,2) not null default 0,
  advance_required boolean not null default false,
  payment_terms text,
  gst_applicable boolean not null default false,
  status text not null default 'active',
  remarks text,
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contract_code)
);

create table if not exists public.fuel_vendor_deposits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  vendor_id text not null references public.vendors(id),
  fuel_contract_id uuid references public.fuel_contracts(id),
  deposit_date date not null,
  deposit_amount numeric(14,2) not null check (deposit_amount > 0),
  payment_mode text not null,
  payment_reference text,
  remarks text,
  status text not null default 'posted',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_stock_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  fuel_type text not null,
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('receipt','issue','adjustment')),
  reference_id uuid,
  quantity_in numeric(14,3) not null default 0,
  quantity_out numeric(14,3) not null default 0,
  balance_quantity numeric(14,3) not null default 0,
  unit_rate numeric(14,2) not null default 0,
  status text not null default 'posted',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_vendor_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  vendor_id text not null references public.vendors(id),
  fuel_contract_id uuid references public.fuel_contracts(id),
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('deposit','advance_receipt','cash_receipt','credit_receipt','payment','adjustment')),
  reference_id uuid,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  balance_after numeric(14,2) not null default 0,
  status text not null default 'posted',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_consumption (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  material_id text not null references public.materials(id),
  consumption_date date not null,
  quantity numeric(14,3) not null check (quantity > 0),
  work_area text,
  purpose text,
  remarks text,
  status text not null default 'posted',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_stock_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  material_id text not null references public.materials(id),
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('receipt','consumption','damage','wastage','adjustment')),
  reference_id uuid,
  quantity_in numeric(14,3) not null default 0,
  quantity_out numeric(14,3) not null default 0,
  balance_quantity numeric(14,3) not null default 0,
  status text not null default 'posted',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_bill_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text not null references public.vendors(id),
  vendor_bill_id uuid not null references public.vendor_bills(id) on delete cascade,
  contract_id uuid references public.vendor_contracts(id),
  source_type text not null check (source_type in ('labour','machinery','fuel','material','general')),
  source_id uuid,
  description text not null,
  quantity numeric(14,3) not null default 0,
  unit text,
  rate numeric(14,2) not null default 0,
  amount numeric(14,2) not null default 0,
  status text not null default 'included',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Common query indexes.
create index if not exists idx_contract_rate_cards_scope on public.vendor_contract_rate_cards(organization_id, project_id, status);
create index if not exists idx_labour_terms_scope on public.labour_contract_terms(organization_id, project_id, vendor_id, status);
create index if not exists idx_labour_allocations_scope on public.casual_labour_work_allocations(organization_id, project_id, vendor_id, allocation_date, status);
create index if not exists idx_labour_bills_scope on public.casual_labour_bills(organization_id, project_id, vendor_id, status, period_from);
create index if not exists idx_contract_machines_scope on public.machinery_contract_machines(organization_id, project_id, vendor_id, status);
create index if not exists idx_breakdowns_scope on public.machine_breakdowns(organization_id, project_id, vendor_id, status, breakdown_start);
create index if not exists idx_fuel_contracts_scope on public.fuel_contracts(organization_id, project_id, vendor_id, status);
create index if not exists idx_fuel_deposits_scope on public.fuel_vendor_deposits(organization_id, project_id, vendor_id, deposit_date);
create index if not exists idx_fuel_stock_scope on public.fuel_stock_ledger(organization_id, project_id, fuel_type, transaction_date);
create index if not exists idx_fuel_vendor_ledger_scope on public.fuel_vendor_ledger(organization_id, project_id, vendor_id, transaction_date);
create index if not exists idx_material_consumption_scope on public.material_consumption(organization_id, project_id, material_id, consumption_date, status);
create index if not exists idx_material_stock_scope on public.material_stock_ledger(organization_id, project_id, material_id, transaction_date);
create index if not exists idx_vendor_bill_items_scope on public.vendor_bill_items(organization_id, project_id, vendor_id, vendor_bill_id, source_type);
create index if not exists idx_vendor_bills_org_status on public.vendor_bills(organization_id, project_id, vendor_id, status, invoice_date);

-- Organization isolation. Service-level role checks remain stricter for writes.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'vendor_contract_rate_cards','labour_contract_terms','labour_payees',
    'casual_labour_work_allocations','casual_labour_bills',
    'machinery_contract_machines','machine_breakdowns','fuel_contracts',
    'fuel_vendor_deposits','fuel_stock_ledger','fuel_vendor_ledger',
    'material_consumption','material_stock_ledger','vendor_bill_items'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = public.current_organization_id())',
      table_name || '_organization_read', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = public.current_organization_id() and created_by = auth.uid())',
      table_name || '_organization_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id())',
      table_name || '_organization_update', table_name
    );
  end loop;
end
$$;
