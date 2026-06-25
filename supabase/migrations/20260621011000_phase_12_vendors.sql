do $$
begin
  create type public.vendor_type as enum (
    'labor',
    'machinery',
    'fuel',
    'material',
    'service'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.vendor_bill_status as enum (
    'draft',
    'submitted',
    'verified',
    'approved',
    'voucher_generated',
    'paid',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.vendor_voucher_status as enum (
    'generated',
    'printed',
    'paid',
    'void'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.vendors (
  id text primary key,
  name text not null,
  code text not null unique,
  vendor_type public.vendor_type not null,
  contact_person text,
  email text,
  phone text,
  gst_number text,
  address text,
  payment_terms text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_bills (
  id uuid primary key default gen_random_uuid(),
  bill_number text not null unique,
  vendor_id text not null references public.vendors(id),
  project_id uuid references public.projects(id),
  bill_type public.vendor_type not null,
  billing_period_from date,
  billing_period_to date,
  invoice_number text,
  invoice_date date,
  base_amount numeric(12, 2) not null default 0,
  gst_amount numeric(12, 2) not null default 0,
  other_charges numeric(12, 2) not null default 0,
  processing_type text not null default 'none',
  processing_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  status public.vendor_bill_status not null default 'draft',
  submitted_by uuid not null references public.user_profiles(id),
  submitted_at timestamptz,
  verified_by uuid references public.user_profiles(id),
  verified_at timestamptz,
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.vendor_payment_vouchers (
  id uuid primary key default gen_random_uuid(),
  vendor_bill_id uuid not null references public.vendor_bills(id),
  vendor_id text not null references public.vendors(id),
  voucher_number text not null unique,
  voucher_date date not null,
  paid_to_name text not null,
  approved_amount numeric(12, 2) not null default 0,
  deduction_amount numeric(12, 2) not null default 0,
  net_payable_amount numeric(12, 2) not null default 0,
  prepared_by uuid not null references public.user_profiles(id),
  accounts_note text,
  status public.vendor_voucher_status not null default 'generated',
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id text not null references public.vendors(id),
  vendor_bill_id uuid not null references public.vendor_bills(id),
  voucher_id uuid not null references public.vendor_payment_vouchers(id),
  amount numeric(12, 2) not null default 0,
  payment_method text not null default 'bank_transfer',
  payment_date date not null,
  reference_number text,
  status text not null default 'processed',
  processed_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  vendor_id text not null references public.vendors(id),
  bill_id uuid references public.vendor_bills(id),
  voucher_id uuid references public.vendor_payment_vouchers(id),
  transaction_type text not null,
  description text,
  debit numeric(12, 2) not null default 0,
  credit numeric(12, 2) not null default 0,
  balance_after numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_vendor_bills_vendor_id on public.vendor_bills(vendor_id);
create index if not exists idx_vendor_bills_project_id on public.vendor_bills(project_id);
create index if not exists idx_vendor_bills_status on public.vendor_bills(status);
create index if not exists idx_vendor_vouchers_vendor_id on public.vendor_payment_vouchers(vendor_id);
create index if not exists idx_vendor_payments_vendor_id on public.vendor_payments(vendor_id);
create index if not exists idx_vendor_ledger_vendor_id on public.vendor_ledger_entries(vendor_id);

alter table public.vendors enable row level security;
alter table public.vendor_bills enable row level security;
alter table public.vendor_payment_vouchers enable row level security;
alter table public.vendor_payments enable row level security;
alter table public.vendor_ledger_entries enable row level security;

drop policy if exists "vendors visible to office roles" on public.vendors;
create policy "vendors visible to office roles"
on public.vendors for select
to authenticated
using (public.current_user_role() in ('manager', 'admin_hr', 'super_admin', 'accounts_officer'));

drop policy if exists "vendors managed by admin roles" on public.vendors;
create policy "vendors managed by admin roles"
on public.vendors for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "vendor bills visible to office roles" on public.vendor_bills;
create policy "vendor bills visible to office roles"
on public.vendor_bills for select
to authenticated
using (
  deleted_at is null
  and public.current_user_role() in ('manager', 'admin_hr', 'super_admin', 'accounts_officer')
);

drop policy if exists "vendor bills created by office roles" on public.vendor_bills;
create policy "vendor bills created by office roles"
on public.vendor_bills for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and public.current_user_role() in ('manager', 'admin_hr', 'super_admin', 'accounts_officer')
);

drop policy if exists "vendor bills updated by control roles" on public.vendor_bills;
create policy "vendor bills updated by control roles"
on public.vendor_bills for update
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin', 'accounts_officer'))
with check (public.current_user_role() in ('admin_hr', 'super_admin', 'accounts_officer'));

drop policy if exists "vendor finance visible to office roles" on public.vendor_payment_vouchers;
create policy "vendor finance visible to office roles"
on public.vendor_payment_vouchers for select
to authenticated
using (public.current_user_role() in ('manager', 'admin_hr', 'super_admin', 'accounts_officer'));

drop policy if exists "vendor vouchers managed by accounts roles" on public.vendor_payment_vouchers;
create policy "vendor vouchers managed by accounts roles"
on public.vendor_payment_vouchers for all
to authenticated
using (public.current_user_role() in ('accounts_officer', 'super_admin'))
with check (
  prepared_by = auth.uid()
  and public.current_user_role() in ('accounts_officer', 'super_admin')
);

drop policy if exists "vendor payments visible to office roles" on public.vendor_payments;
create policy "vendor payments visible to office roles"
on public.vendor_payments for select
to authenticated
using (public.current_user_role() in ('manager', 'admin_hr', 'super_admin', 'accounts_officer'));

drop policy if exists "vendor payments managed by accounts roles" on public.vendor_payments;
create policy "vendor payments managed by accounts roles"
on public.vendor_payments for all
to authenticated
using (public.current_user_role() in ('accounts_officer', 'super_admin'))
with check (
  processed_by = auth.uid()
  and public.current_user_role() in ('accounts_officer', 'super_admin')
);

drop policy if exists "vendor ledger visible to office roles" on public.vendor_ledger_entries;
create policy "vendor ledger visible to office roles"
on public.vendor_ledger_entries for select
to authenticated
using (public.current_user_role() in ('manager', 'admin_hr', 'super_admin', 'accounts_officer'));

insert into public.vendors (id, name, code, vendor_type, contact_person, email, phone, gst_number, address, payment_terms, status)
values
  ('vendor-apex-fuel', 'Apex Fuel Supply', 'VEN-FUEL-001', 'fuel', 'Nikhil Rao', 'ven-fuel-001@siteconnect.local', '+91 98765 60001', '29AABCV0011Z5', 'Bengaluru', '15 days', 'active'),
  ('vendor-buildmart', 'BuildMart Supplies', 'VEN-MAT-001', 'material', 'Sanjay Bhat', 'ven-mat-001@siteconnect.local', '+91 98765 60001', '29AABCV0011Z5', 'Bengaluru', '15 days', 'active'),
  ('vendor-apex-machinery', 'Apex Plant & Machinery', 'VEN-MCH-001', 'machinery', 'Rajat Menon', 'ven-mch-001@siteconnect.local', '+91 98765 60001', '29AABCV0011Z5', 'Bengaluru', '15 days', 'active')
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  vendor_type = excluded.vendor_type,
  contact_person = excluded.contact_person,
  email = excluded.email,
  phone = excluded.phone,
  gst_number = excluded.gst_number,
  address = excluded.address,
  payment_terms = excluded.payment_terms,
  status = excluded.status;
