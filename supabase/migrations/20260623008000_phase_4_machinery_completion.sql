-- Phase 4: complete machinery contract terms, machine metadata and log fields.

alter table public.machinery_contract_terms
  add column if not exists working_days_per_month numeric(6,2) not null default 26,
  add column if not exists sunday_included boolean not null default false,
  add column if not exists driver_beta_amount numeric(14,2) not null default 0,
  add column if not exists idle_deduction_rule text,
  add column if not exists updated_by uuid references public.user_profiles(id);

alter table public.machinery_contract_machines
  add column if not exists vendor_contract_id uuid references public.vendor_contracts(id) on delete cascade,
  add column if not exists capacity text,
  add column if not exists ownership text check (ownership in ('company','rented','hired')),
  add column if not exists remarks text;

update public.machinery_contract_machines
set vendor_contract_id = coalesce(vendor_contract_id, contract_id),
    ownership = coalesce(ownership, 'rented')
where vendor_contract_id is null
   or ownership is null;

alter table public.machine_logs
  add column if not exists trip_count integer not null default 0,
  add column if not exists source_location text,
  add column if not exists destination_location text,
  add column if not exists load_type text,
  add column if not exists operational_status text not null default 'active'
    check (operational_status in ('active','idle','standby','breakdown')),
  add column if not exists billing_type text,
  add column if not exists billing_rate numeric(14,2);

alter table public.machine_log_sessions
  add column if not exists remarks text;

alter table public.machine_breakdowns
  add column if not exists breakdown_end timestamptz,
  add column if not exists deduction_amount numeric(14,2) not null default 0,
  add column if not exists remarks text;

create index if not exists idx_machine_logs_operational_status
  on public.machine_logs(organization_id, project_id, operational_status, log_date);
create index if not exists idx_machine_logs_contract
  on public.machine_logs(contract_id, log_date);
create index if not exists idx_machine_breakdowns_log
  on public.machine_breakdowns(machine_log_id, status);
