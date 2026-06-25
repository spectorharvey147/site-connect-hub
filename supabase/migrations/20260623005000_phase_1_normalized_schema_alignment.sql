-- Phase 1 schema alignment: fill canonical normalized table gaps without
-- disturbing existing module tables or historical data.

create table if not exists public.casual_labour_attendance_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text references public.vendors(id),
  contract_id uuid references public.vendor_contracts(id),
  attendance_id uuid not null references public.casual_labour_attendance(id) on delete cascade,
  roster_id uuid references public.labour_rosters(id),
  worker_code text,
  worker_name text,
  entry_mode text not null default 'named_worker' check (entry_mode in ('named_worker', 'count_based')),
  category text not null,
  gender text,
  skill_type text,
  worker_count integer not null default 1 check (worker_count > 0),
  start_time time,
  end_time time,
  worked_hours numeric(8,2) not null default 0,
  normal_hours numeric(8,2) not null default 0,
  overtime_hours numeric(8,2) not null default 0,
  normal_rate numeric(14,2) not null default 0,
  overtime_rate numeric(14,2) not null default 0,
  allowance numeric(14,2) not null default 0,
  deduction numeric(14,2) not null default 0,
  normal_amount numeric(14,2) not null default 0,
  overtime_amount numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  payee_type text check (payee_type in ('vendor', 'incharge', 'individual')),
  payee_id uuid references public.labour_payees(id),
  payee_name text,
  manual_override_reason text,
  remarks text,
  status text not null default 'submitted',
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.labour_advance_deductions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text references public.vendors(id),
  contract_id uuid references public.vendor_contracts(id),
  payee_id uuid references public.labour_payees(id),
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('advance', 'deduction', 'adjustment')),
  amount numeric(14,2) not null check (amount > 0),
  reference_id uuid,
  remarks text,
  status text not null default 'posted',
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_cash_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text references public.vendors(id),
  contract_id uuid references public.vendor_contracts(id),
  fuel_receipt_id uuid references public.fuel_receipts(id) on delete set null,
  expense_date date not null,
  fuel_type text not null,
  quantity numeric(14,3) not null default 0,
  rate_per_unit numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  paid_by uuid references public.user_profiles(id),
  payment_mode text,
  payment_reference text,
  claim_id uuid references public.claims(id),
  remarks text,
  status text not null default 'submitted',
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_damage_wastage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text references public.vendors(id),
  contract_id uuid references public.vendor_contracts(id),
  material_id text not null references public.materials(id),
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('damage', 'wastage')),
  quantity numeric(14,3) not null check (quantity > 0),
  reason text not null,
  approved_by uuid references public.user_profiles(id),
  remarks text,
  status text not null default 'submitted',
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dpr_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id),
  department_id uuid references public.departments(id),
  cost_code_id uuid references public.project_cost_codes(id),
  vendor_id text references public.vendors(id),
  contract_id uuid references public.vendor_contracts(id),
  daily_progress_report_id uuid unique references public.daily_progress_reports(id) on delete cascade,
  report_number text not null,
  report_date date not null,
  weather jsonb not null default '[]'::jsonb,
  labour_count integer not null default 0,
  machinery_used jsonb not null default '[]'::jsonb,
  material_usage jsonb not null default '[]'::jsonb,
  fuel_usage jsonb not null default '[]'::jsonb,
  completion_percentage numeric(5,2) not null default 0,
  issues text,
  next_day_plan text,
  remarks text,
  status text not null default 'draft',
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, report_number)
);

insert into public.dpr_reports (
  organization_id,
  project_id,
  department_id,
  daily_progress_report_id,
  report_number,
  report_date,
  weather,
  next_day_plan,
  status,
  created_by,
  created_at,
  updated_at
)
select
  organization_id,
  project_id,
  department_id,
  id,
  dpr_number,
  report_date,
  to_jsonb(coalesce(weather, '{}'::text[])),
  next_day_plan,
  status,
  coalesce(created_by, submitted_by),
  created_at,
  updated_at
from public.daily_progress_reports
where organization_id is not null
  and not exists (
    select 1
    from public.dpr_reports existing
    where existing.daily_progress_report_id = daily_progress_reports.id
  );

create index if not exists idx_labour_attendance_items_scope
  on public.casual_labour_attendance_items(organization_id, project_id, department_id, vendor_id, contract_id, status);
create index if not exists idx_labour_attendance_items_date
  on public.casual_labour_attendance_items(attendance_id, created_at);
create index if not exists idx_labour_attendance_items_created_by
  on public.casual_labour_attendance_items(created_by);

create index if not exists idx_labour_advance_deductions_scope
  on public.labour_advance_deductions(organization_id, project_id, department_id, vendor_id, contract_id, status);
create index if not exists idx_labour_advance_deductions_date
  on public.labour_advance_deductions(transaction_date);
create index if not exists idx_labour_advance_deductions_created_by
  on public.labour_advance_deductions(created_by);

create index if not exists idx_fuel_cash_expenses_scope
  on public.fuel_cash_expenses(organization_id, project_id, department_id, vendor_id, contract_id, status);
create index if not exists idx_fuel_cash_expenses_date
  on public.fuel_cash_expenses(expense_date);
create index if not exists idx_fuel_cash_expenses_created_by
  on public.fuel_cash_expenses(created_by);

create index if not exists idx_material_damage_wastage_scope
  on public.material_damage_wastage(organization_id, project_id, department_id, vendor_id, contract_id, status);
create index if not exists idx_material_damage_wastage_date
  on public.material_damage_wastage(transaction_date);
create index if not exists idx_material_damage_wastage_created_by
  on public.material_damage_wastage(created_by);

create index if not exists idx_dpr_reports_scope
  on public.dpr_reports(organization_id, project_id, department_id, vendor_id, contract_id, status);
create index if not exists idx_dpr_reports_date
  on public.dpr_reports(report_date);
create index if not exists idx_dpr_reports_created_by
  on public.dpr_reports(created_by);

do $$
declare
  target text;
begin
  foreach target in array array[
    'casual_labour_attendance_items',
    'labour_advance_deductions',
    'fuel_cash_expenses',
    'material_damage_wastage',
    'dpr_reports'
  ]
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

do $$
declare
  target text;
begin
  foreach target in array array[
    'casual_labour_attendance_items',
    'labour_advance_deductions',
    'fuel_cash_expenses',
    'material_damage_wastage',
    'dpr_reports'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', target, target);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      target, target
    );
  end loop;
end
$$;
