-- Canonical normalized service contract used by the frontend repositories.

alter type public.vendor_bill_status add value if not exists 'partially_paid';

create table if not exists public.labour_rosters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text references public.vendors(id),
  contract_id uuid references public.vendor_contracts(id) on delete cascade,
  worker_code text not null,
  worker_name text not null,
  gender text,
  category text not null,
  skill_type text,
  phone text,
  id_proof_optional text,
  daily_rate_override numeric(14,2),
  ot_rate_override numeric(14,2),
  status text not null default 'active',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, worker_code)
);

alter table public.casual_labour_attendance
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists cost_code_id uuid references public.project_cost_codes(id),
  add column if not exists contract_id uuid references public.vendor_contracts(id),
  add column if not exists created_by uuid references public.user_profiles(id);

alter table public.casual_labour_attendance_rows
  alter column worker_id drop not null,
  add column if not exists roster_id uuid references public.labour_rosters(id),
  add column if not exists worker_code text,
  add column if not exists project_id uuid references public.projects(id),
  add column if not exists vendor_id text references public.vendors(id),
  add column if not exists contract_id uuid references public.vendor_contracts(id),
  add column if not exists worker_name text,
  add column if not exists gender text,
  add column if not exists skill_type text,
  add column if not exists worked_hours numeric(8,2) not null default 0,
  add column if not exists normal_amount numeric(14,2) not null default 0,
  add column if not exists overtime_amount numeric(14,2) not null default 0,
  add column if not exists allowance numeric(14,2) not null default 0,
  add column if not exists deduction numeric(14,2) not null default 0,
  add column if not exists net_amount numeric(14,2) not null default 0,
  add column if not exists payee_type text check (payee_type in ('vendor','incharge','individual')),
  add column if not exists payee_id uuid references public.labour_payees(id),
  add column if not exists payee_name text;

alter table public.casual_labour_bills
  add column if not exists attendance_id uuid unique references public.casual_labour_attendance(id);

create table if not exists public.machinery_contract_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text not null references public.vendors(id),
  vendor_contract_id uuid references public.vendor_contracts(id),
  contract_code text not null,
  billing_type text not null check (billing_type in ('monthly','weekly','daily','hourly','per_trip')),
  monthly_rate numeric(14,2) not null default 0,
  weekly_rate numeric(14,2) not null default 0,
  daily_rate numeric(14,2) not null default 0,
  hourly_rate numeric(14,2) not null default 0,
  trip_rate numeric(14,2) not null default 0,
  working_days_per_month int not null default 26,
  sunday_included boolean not null default false,
  minimum_hours_per_day numeric(8,2) not null default 0,
  ot_rate_per_hour numeric(14,2) not null default 0,
  driver_cost_scope text not null default 'included',
  driver_beta_amount numeric(14,2) not null default 0,
  driver_food_scope text not null default 'included',
  fuel_scope text not null default 'excluded',
  breakdown_deduction_rule text,
  idle_deduction_rule text,
  contract_start_date date not null,
  contract_end_date date not null,
  status text not null default 'active',
  remarks text,
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contract_code)
);

alter table public.machine_logs
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists cost_code_id uuid references public.project_cost_codes(id),
  add column if not exists vendor_id text references public.vendors(id),
  add column if not exists contract_id uuid references public.vendor_contracts(id),
  add column if not exists trip_count numeric(12,2) not null default 0,
  add column if not exists source_location text,
  add column if not exists destination_location text,
  add column if not exists load_type text,
  add column if not exists operational_status text not null default 'active',
  add column if not exists billing_type text,
  add column if not exists billing_rate numeric(14,2) not null default 0,
  add column if not exists calculated_cost numeric(14,2) not null default 0,
  add column if not exists created_by uuid references public.user_profiles(id);

alter table public.machine_log_sessions
  add column if not exists remarks text;

alter table public.fuel_receipts
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists cost_code_id uuid references public.project_cost_codes(id),
  add column if not exists fuel_contract_id uuid references public.fuel_contracts(id),
  add column if not exists bill_attachment text,
  add column if not exists created_by uuid references public.user_profiles(id);

alter table public.fuel_issues
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists cost_code_id uuid references public.project_cost_codes(id),
  add column if not exists created_by uuid references public.user_profiles(id);

alter table public.material_requests
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists cost_code_id uuid references public.project_cost_codes(id),
  add column if not exists created_by uuid references public.user_profiles(id);

alter table public.material_receipts
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists cost_code_id uuid references public.project_cost_codes(id),
  add column if not exists created_by uuid references public.user_profiles(id);

alter table public.daily_progress_reports
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists department_id uuid references public.departments(id),
  add column if not exists cost_code_id uuid references public.project_cost_codes(id),
  add column if not exists created_by uuid references public.user_profiles(id);

alter table public.material_receipt_items
  add column if not exists rate_per_unit numeric(14,2) not null default 0,
  add column if not exists amount numeric(14,2) not null default 0;

create table if not exists public.vendor_ledgers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text not null references public.vendors(id),
  contract_id uuid references public.vendor_contracts(id),
  bill_id uuid references public.vendor_bills(id),
  voucher_id uuid references public.vendor_payment_vouchers(id),
  payment_id uuid references public.vendor_payments(id),
  transaction_date date not null default current_date,
  transaction_type text not null,
  description text,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  balance_after numeric(14,2) not null default 0,
  status text not null default 'posted',
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_labour_rosters_scope on public.labour_rosters(organization_id, project_id, vendor_id, contract_id, status);
create index if not exists idx_labour_attendance_org_scope on public.casual_labour_attendance(organization_id, project_id, vendor_id, status, date);
create index if not exists idx_machinery_terms_scope on public.machinery_contract_terms(organization_id, project_id, vendor_id, status);
create index if not exists idx_machine_logs_org_scope on public.machine_logs(organization_id, project_id, vendor_id, status, log_date);
create index if not exists idx_fuel_receipts_org_scope on public.fuel_receipts(organization_id, project_id, vendor_id, status, receipt_date);
create index if not exists idx_fuel_issues_org_scope on public.fuel_issues(organization_id, project_id, status, issue_date);
create index if not exists idx_material_requests_org_scope on public.material_requests(organization_id, project_id, status, request_date);
create index if not exists idx_material_receipts_org_scope on public.material_receipts(organization_id, project_id, vendor_id, status, receipt_date);
create index if not exists idx_dpr_org_scope on public.daily_progress_reports(organization_id, project_id, department_id, status, report_date);
create index if not exists idx_vendor_ledgers_scope on public.vendor_ledgers(organization_id, project_id, vendor_id, transaction_date, status);

do $$
declare
  target text;
begin
  foreach target in array array['labour_rosters','machinery_contract_terms','vendor_ledgers']
  loop
    execute format('alter table public.%I enable row level security', target);
    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id = public.current_organization_id())',
      target || '_read', target
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id = public.current_organization_id() and created_by = auth.uid())',
      target || '_insert', target
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id())',
      target || '_update', target
    );
  end loop;
end
$$;

-- Existing transaction tables already have module RLS; require tenant columns
-- to match the current organization when they are populated.
update public.casual_labour_attendance row
set organization_id = project.organization_id,
    created_by = coalesce(row.created_by, row.submitted_by)
from public.projects project
where row.project_id = project.id and row.organization_id is null;

update public.machine_logs row
set organization_id = project.organization_id,
    created_by = coalesce(row.created_by, row.submitted_by)
from public.projects project
where row.project_id = project.id and row.organization_id is null;

update public.fuel_receipts row
set organization_id = project.organization_id,
    created_by = coalesce(row.created_by, row.submitted_by)
from public.projects project
where row.project_id = project.id and row.organization_id is null;

update public.fuel_issues row
set organization_id = project.organization_id,
    created_by = coalesce(row.created_by, row.submitted_by)
from public.projects project
where row.project_id = project.id and row.organization_id is null;

update public.material_requests row
set organization_id = project.organization_id,
    created_by = coalesce(row.created_by, row.requested_by)
from public.projects project
where row.project_id = project.id and row.organization_id is null;

update public.material_receipts row
set organization_id = project.organization_id,
    created_by = coalesce(row.created_by, row.received_by)
from public.projects project
where row.project_id = project.id and row.organization_id is null;

update public.daily_progress_reports row
set organization_id = project.organization_id,
    created_by = coalesce(row.created_by, row.submitted_by)
from public.projects project
where row.project_id = project.id and row.organization_id is null;
