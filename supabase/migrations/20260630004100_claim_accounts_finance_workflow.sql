-- Claims finance workflow: accounts verification, vouchers, SAP, payments,
-- employee ledger, email actions, signatures, and report snapshots.

alter table public.claims add column if not exists organization_id uuid references public.organizations(id);
alter table public.claims add column if not exists department_id uuid references public.departments(id);
alter table public.claims add column if not exists customer_id uuid references public.customers(id);

create table if not exists public.claim_accounts_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  claim_id uuid not null references public.claims(id) on delete cascade,
  verified_by uuid references public.user_profiles(id),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'returned', 'rejected')),
  verification_date timestamptz,
  accounts_remarks text,
  payable_amount numeric(12,2) not null default 0 check (payable_amount >= 0),
  deduction_amount numeric(12,2) not null default 0 check (deduction_amount >= 0),
  payment_priority text not null default 'normal'
    check (payment_priority in ('normal', 'urgent', 'hold')),
  requires_sap_export boolean not null default false,
  sap_export_status text not null default 'not_required'
    check (sap_export_status in ('not_required', 'pending', 'exported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (claim_id),
  check (deduction_amount <= payable_amount + deduction_amount)
);

create table if not exists public.claim_payment_batches (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  batch_number text not null, employee_id uuid not null references public.user_profiles(id),
  project_id uuid references public.projects(id), department_id uuid references public.departments(id),
  from_date date not null, to_date date not null, total_claims integer not null default 0,
  gross_claimed_amount numeric(12,2) not null default 0, gross_verified_amount numeric(12,2) not null default 0,
  gross_deduction_amount numeric(12,2) not null default 0, net_payable_amount numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','voucher_generated','payment_pending','partially_paid','paid','cancelled')),
  created_by uuid not null references public.user_profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, batch_number), check (to_date >= from_date)
);

create table if not exists public.claim_payment_vouchers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  voucher_number text not null, voucher_type text not null default 'single_claim' check (voucher_type in ('single_claim','combined_claim')),
  voucher_date date not null default current_date, employee_id uuid not null references public.user_profiles(id),
  employee_name_snapshot text not null, employee_email_snapshot text, department_id uuid references public.departments(id),
  project_id uuid references public.projects(id), customer_id uuid references public.customers(id), batch_id uuid references public.claim_payment_batches(id),
  prepared_by uuid references public.user_profiles(id), verified_by uuid references public.user_profiles(id),
  approved_by uuid references public.user_profiles(id), accounts_user_id uuid references public.user_profiles(id),
  gross_claimed_amount numeric(12,2) not null default 0, gross_verified_amount numeric(12,2) not null default 0,
  gross_deduction_amount numeric(12,2) not null default 0, net_payable_amount numeric(12,2) not null default 0,
  amount_in_words text, payment_status text not null default 'pending' check (payment_status in ('pending','partially_paid','paid','cancelled')),
  payment_reference text, payment_mode text, payment_date date, voucher_pdf_path text, voucher_with_attachments_pdf_path text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id, voucher_number)
);

create table if not exists public.claim_payment_voucher_items (
  id uuid primary key default gen_random_uuid(), voucher_id uuid not null references public.claim_payment_vouchers(id) on delete cascade,
  claim_id uuid not null references public.claims(id), claim_item_id uuid references public.claim_items(id), claim_number text not null,
  expense_date date, expense_category_id text references public.expense_categories(id), expense_category_snapshot text,
  project_id uuid references public.projects(id), project_name_snapshot text, project_cost_code_id uuid references public.project_cost_codes(id),
  project_cost_code_snapshot text, customer_id uuid references public.customers(id), customer_name_snapshot text,
  description text, bill_reference text, with_bill_amount numeric(12,2) not null default 0,
  without_bill_amount numeric(12,2) not null default 0, claimed_amount numeric(12,2) not null default 0,
  admin_verified_amount numeric(12,2) not null default 0, manager_approved_amount numeric(12,2) not null default 0,
  final_approved_amount numeric(12,2) not null default 0, deduction_amount numeric(12,2) not null default 0,
  remarks text, sort_order integer not null default 0, created_at timestamptz not null default now(), unique (voucher_id, claim_id, claim_item_id)
);

create table if not exists public.claim_payment_voucher_attachments (
  id uuid primary key default gen_random_uuid(), voucher_id uuid not null references public.claim_payment_vouchers(id) on delete cascade,
  claim_id uuid not null references public.claims(id), source_attachment_id uuid references public.claim_attachments(id), file_name text not null,
  file_path text not null, mime_type text, include_in_combined_pdf boolean not null default true, created_at timestamptz not null default now(),
  unique (voucher_id, source_attachment_id)
);

create table if not exists public.claim_payments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  voucher_id uuid not null references public.claim_payment_vouchers(id), batch_id uuid references public.claim_payment_batches(id),
  employee_id uuid not null references public.user_profiles(id), payment_date date not null default current_date,
  payment_amount numeric(12,2) not null check (payment_amount > 0), payment_mode text not null, payment_reference text,
  bank_name text, remarks text, payment_proof_path text, created_by uuid not null references public.user_profiles(id), created_at timestamptz not null default now()
);

create table if not exists public.claim_sap_export_batches (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), sap_batch_number text not null,
  export_date timestamptz not null default now(), exported_by uuid not null references public.user_profiles(id),
  export_type text not null check (export_type in ('preview','final')), file_path text, file_name text,
  total_claims integer not null default 0, total_vouchers integer not null default 0, total_amount numeric(12,2) not null default 0,
  status text not null default 'generated' check (status in ('generated','downloaded','cancelled')), remarks text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id, sap_batch_number)
);

create table if not exists public.claim_sap_export_items (
  id uuid primary key default gen_random_uuid(), sap_batch_id uuid not null references public.claim_sap_export_batches(id) on delete cascade,
  voucher_id uuid not null references public.claim_payment_vouchers(id), claim_id uuid not null references public.claims(id),
  employee_id uuid not null references public.user_profiles(id), project_id uuid references public.projects(id), customer_id uuid references public.customers(id),
  cost_code_id uuid references public.project_cost_codes(id), expense_category_id text references public.expense_categories(id),
  sap_gl_code text not null, sap_cost_center text, sap_profit_center text, sap_vendor_or_employee_code text not null,
  posting_date date not null, document_date date not null, amount numeric(12,2) not null check (amount >= 0),
  debit_credit text not null check (debit_credit in ('debit','credit')), narration text, created_at timestamptz not null default now()
);
create unique index if not exists uq_sap_batch_voucher_claim on public.claim_sap_export_items(sap_batch_id,voucher_id,claim_id);

create table if not exists public.employee_advances (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  employee_id uuid not null references public.user_profiles(id), advance_type text not null check (advance_type in ('opening_balance','rolling_advance','temporary_advance','adjustment')),
  advance_date date not null, amount numeric(12,2) not null check (amount > 0), reference_number text, remarks text,
  created_by uuid not null references public.user_profiles(id), created_at timestamptz not null default now()
);

create table if not exists public.employee_ledger_entries (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  employee_id uuid not null references public.user_profiles(id), entry_date timestamptz not null default now(),
  entry_type text not null check (entry_type in ('opening_balance','advance_added','claim_submitted','claim_verified','claim_deduction','voucher_generated','payment_processed','partial_payment','rejection_adjustment','manual_adjustment')),
  reference_type text not null check (reference_type in ('claim','voucher','payment','advance','adjustment')), reference_id uuid not null,
  debit_amount numeric(12,2) not null default 0 check (debit_amount >= 0), credit_amount numeric(12,2) not null default 0 check (credit_amount >= 0),
  balance_after numeric(12,2) not null default 0, remarks text, created_by uuid references public.user_profiles(id), created_at timestamptz not null default now(),
  unique (employee_id, entry_type, reference_type, reference_id)
);

create table if not exists public.claim_email_action_tokens (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), claim_id uuid not null references public.claims(id) on delete cascade,
  approver_user_id uuid not null references public.user_profiles(id), approver_role text not null,
  action_scope text not null check (action_scope in ('admin_verify','manager_approve','hod_approve','super_admin_approve','accounts_verify')),
  token_hash text not null unique, expires_at timestamptz not null, used_at timestamptz, used_action text, used_ip inet, created_at timestamptz not null default now(),
  check (used_at is null or used_action is not null)
);

create table if not exists public.user_signatures (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), user_id uuid not null references public.user_profiles(id) on delete cascade,
  signature_path text not null, signature_name text not null, uploaded_by uuid not null references public.user_profiles(id), is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists uq_active_user_signature on public.user_signatures(organization_id,user_id) where is_active;

create table if not exists public.claim_report_snapshots (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), report_type text not null,
  snapshot_date timestamptz not null default now(), filters jsonb not null default '{}'::jsonb, summary jsonb not null default '{}'::jsonb,
  data jsonb not null default '[]'::jsonb, generated_by uuid not null references public.user_profiles(id), created_at timestamptz not null default now()
);

create table if not exists public.sap_gl_mappings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), expense_category_id text references public.expense_categories(id),
  project_cost_code_id uuid references public.project_cost_codes(id), customer_id uuid references public.customers(id), department_id uuid references public.departments(id),
  sap_gl_code text not null, sap_cost_center text, sap_profit_center text, company_code text not null, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.sap_cost_center_mappings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), project_id uuid references public.projects(id),
  project_cost_code_id uuid references public.project_cost_codes(id), department_id uuid references public.departments(id), sap_cost_center text not null,
  sap_profit_center text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.sap_export_settings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null unique references public.organizations(id), company_code text not null,
  currency text not null default 'INR', employee_vendor_code_rule text not null default 'employee_code', enabled boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists idx_claim_accounts_status on public.claim_accounts_verifications(organization_id,verification_status);
create index if not exists idx_claim_vouchers_employee on public.claim_payment_vouchers(organization_id,employee_id,payment_status);
create index if not exists idx_claim_payments_voucher on public.claim_payments(voucher_id,payment_date);
create index if not exists idx_employee_ledger_employee_date on public.employee_ledger_entries(employee_id,entry_date);
create index if not exists idx_sap_batches_org_date on public.claim_sap_export_batches(organization_id,export_date desc);
create unique index if not exists uq_open_voucher_claim on public.claim_payment_voucher_items(claim_id)
  where claim_item_id is null;

-- Enforce the finance amount invariant against the immutable final-approved total.
create or replace function public.validate_claim_accounts_verification()
returns trigger language plpgsql security definer set search_path = public as $$
declare approved numeric(12,2);
begin
  select total_approved into approved from public.claims where id = new.claim_id;
  if new.payable_amount > coalesce(approved,0) then raise exception 'Payable amount cannot exceed final approved amount'; end if;
  if new.deduction_amount <> coalesce(approved,0) - new.payable_amount then raise exception 'Deduction must equal final approved amount minus payable amount'; end if;
  if new.verification_status in ('returned','rejected') and nullif(btrim(new.accounts_remarks),'') is null then raise exception 'Accounts remarks are required'; end if;
  new.sap_export_status := case when new.requires_sap_export then coalesce(nullif(new.sap_export_status,'not_required'),'pending') else 'not_required' end;
  return new;
end $$;
drop trigger if exists validate_claim_accounts_verification on public.claim_accounts_verifications;
create trigger validate_claim_accounts_verification before insert or update on public.claim_accounts_verifications
for each row execute function public.validate_claim_accounts_verification();

-- A final approval can never bypass Accounts.
create or replace function public.ensure_claim_accounts_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('final_approved','accounts_verification_pending') and old.status is distinct from new.status then
    new.status := 'accounts_verification_pending';
    insert into public.claim_accounts_verifications(organization_id,claim_id,payable_amount,deduction_amount)
    values(new.organization_id,new.id,new.total_approved,0) on conflict(claim_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists ensure_claim_accounts_verification on public.claims;
create trigger ensure_claim_accounts_verification before update of status on public.claims
for each row execute function public.ensure_claim_accounts_verification();

do $$ declare table_name text; begin
  foreach table_name in array array['claim_accounts_verifications','claim_payment_batches','claim_payment_vouchers','claim_payment_voucher_items','claim_payment_voucher_attachments','claim_payments','claim_sap_export_batches','claim_sap_export_items','employee_advances','employee_ledger_entries','claim_email_action_tokens','user_signatures','claim_report_snapshots','sap_gl_mappings','sap_cost_center_mappings','sap_export_settings'] loop
    execute format('alter table public.%I enable row level security',table_name);
  end loop;
end $$;

-- Finance tables are readable/writable by Accounts and Super Admin. Admin/HR can
-- read verification/voucher data. Employees can read their own vouchers/ledger.
create policy "finance manages accounts verification" on public.claim_accounts_verifications for all to authenticated
using (public.current_user_role() in ('accounts_officer','super_admin')) with check (public.current_user_role() in ('accounts_officer','super_admin'));
create policy "authorized users read accounts verification" on public.claim_accounts_verifications for select to authenticated
using (public.current_user_role() in ('admin_hr','accounts_officer','super_admin') or exists(select 1 from public.claims c where c.id=claim_id and c.user_id=auth.uid()));
create policy "finance manages claim vouchers" on public.claim_payment_vouchers for all to authenticated
using (public.current_user_role() in ('accounts_officer','super_admin')) with check (public.current_user_role() in ('accounts_officer','super_admin'));
create policy "employees read own claim vouchers" on public.claim_payment_vouchers for select to authenticated
using (employee_id=auth.uid() or public.current_user_role() in ('admin_hr','accounts_officer','super_admin'));
create policy "finance manages employee ledger entries" on public.employee_ledger_entries for all to authenticated
using (public.current_user_role() in ('accounts_officer','super_admin')) with check (public.current_user_role() in ('accounts_officer','super_admin'));
create policy "employees read own ledger entries" on public.employee_ledger_entries for select to authenticated
using (employee_id=auth.uid() or public.current_user_role() in ('admin_hr','accounts_officer','super_admin'));

-- Remaining finance child/config tables inherit access through role checks.
do $$ declare t text; begin
  foreach t in array array['claim_payment_batches','claim_payment_voucher_items','claim_payment_voucher_attachments','claim_payments','claim_sap_export_batches','claim_sap_export_items','employee_advances','claim_report_snapshots','sap_gl_mappings','sap_cost_center_mappings','sap_export_settings'] loop
    execute format('create policy "finance role access" on public.%I for all to authenticated using (public.current_user_role() in (''accounts_officer'',''super_admin'')) with check (public.current_user_role() in (''accounts_officer'',''super_admin''))',t);
  end loop;
end $$;
create policy "token lookup through server only" on public.claim_email_action_tokens for select to authenticated using (approver_user_id=auth.uid());
create policy "signature visibility" on public.user_signatures for select to authenticated using (is_active or user_id=auth.uid() or public.current_user_role() in ('admin_hr','super_admin'));
create policy "signature management" on public.user_signatures for all to authenticated
using (user_id=auth.uid() or public.current_user_role() in ('admin_hr','super_admin')) with check (user_id=auth.uid() or public.current_user_role() in ('admin_hr','super_admin'));

comment on column public.claim_email_action_tokens.token_hash is 'SHA-256 hash only; raw token must never be persisted.';
