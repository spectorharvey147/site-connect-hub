do $$
begin
  create type public.claim_status as enum (
    'draft',
    'submitted',
    'admin_verification_pending',
    'admin_verified',
    'manager_approval_pending',
    'manager_approved',
    'super_admin_approval_pending',
    'approved_for_payment',
    'voucher_generated',
    'paid',
    'rejected',
    'changes_requested',
    'withdrawn'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.claim_bill_type as enum ('with_bill', 'without_bill');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.claim_approval_stage as enum (
    'submission',
    'admin_verification',
    'manager_approval',
    'final_approval',
    'accounts_payment'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.claim_decision as enum (
    'submitted',
    'approved',
    'reduced',
    'rejected',
    'changes_requested',
    'voucher_generated',
    'paid',
    'withdrawn'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.expense_categories (
  id text primary key,
  name text not null,
  description text,
  requires_bill boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  claim_number text not null unique,
  title text not null,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  project_id uuid references public.projects(id),
  period_from date not null,
  period_to date not null,
  status public.claim_status not null default 'draft',
  total_claimed numeric(12, 2) not null default 0,
  total_verified numeric(12, 2) not null default 0,
  total_approved numeric(12, 2) not null default 0,
  remarks text,
  submitted_at timestamptz,
  paid_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.claim_items (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  category_id text references public.expense_categories(id),
  project_id uuid references public.projects(id),
  project_cost_code_id uuid references public.project_cost_codes(id),
  description text not null,
  bill_type public.claim_bill_type not null,
  amount numeric(12, 2) not null check (amount >= 0),
  expense_date date not null,
  attachment_link text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.claim_attachments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text,
  file_size int,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.claim_approvals (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  stage public.claim_approval_stage not null,
  decision public.claim_decision not null,
  actor_id uuid not null references public.user_profiles(id),
  actor_role text not null,
  remarks text,
  amount_before numeric(12, 2),
  amount_after numeric(12, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_vouchers (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.claims(id) on delete set null,
  voucher_number text not null unique,
  voucher_date date not null default current_date,
  paid_to_name text not null,
  paid_to_email text,
  approved_amount numeric(12, 2) not null default 0,
  deduction_amount numeric(12, 2) not null default 0,
  net_payable_amount numeric(12, 2) not null default 0,
  prepared_by uuid references public.user_profiles(id),
  verified_by uuid references public.user_profiles(id),
  approved_by uuid references public.user_profiles(id),
  accounts_note text,
  status text not null default 'generated',
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  reference_type text not null,
  reference_id uuid,
  amount numeric(12, 2) not null,
  payment_method text not null default 'bank_transfer',
  payment_date date not null default current_date,
  reference_number text,
  status text not null default 'processed',
  processed_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.employee_ledgers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete set null,
  voucher_id uuid references public.payment_vouchers(id) on delete set null,
  transaction_type text not null,
  description text not null,
  debit numeric(12, 2) not null default 0,
  credit numeric(12, 2) not null default 0,
  balance_after numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_claims_user_id on public.claims(user_id);
create index if not exists idx_claims_project_id on public.claims(project_id);
create index if not exists idx_claims_status on public.claims(status);
create index if not exists idx_claims_created_at on public.claims(created_at);
create index if not exists idx_claim_items_claim_id on public.claim_items(claim_id);
create index if not exists idx_claim_attachments_claim_id on public.claim_attachments(claim_id);
create index if not exists idx_claim_approvals_claim_id on public.claim_approvals(claim_id);
create index if not exists idx_payment_vouchers_claim_id on public.payment_vouchers(claim_id);
create index if not exists idx_payment_vouchers_status on public.payment_vouchers(status);
create index if not exists idx_payments_reference on public.payments(reference_type, reference_id);
create index if not exists idx_employee_ledgers_user_id on public.employee_ledgers(user_id);
create index if not exists idx_employee_ledgers_claim_id on public.employee_ledgers(claim_id);

drop trigger if exists set_expense_categories_updated_at on public.expense_categories;
create trigger set_expense_categories_updated_at
before update on public.expense_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_claims_updated_at on public.claims;
create trigger set_claims_updated_at
before update on public.claims
for each row execute function public.set_updated_at();

drop trigger if exists set_claim_items_updated_at on public.claim_items;
create trigger set_claim_items_updated_at
before update on public.claim_items
for each row execute function public.set_updated_at();

drop trigger if exists set_payment_vouchers_updated_at on public.payment_vouchers;
create trigger set_payment_vouchers_updated_at
before update on public.payment_vouchers
for each row execute function public.set_updated_at();

alter table public.expense_categories enable row level security;
alter table public.claims enable row level security;
alter table public.claim_items enable row level security;
alter table public.claim_attachments enable row level security;
alter table public.claim_approvals enable row level security;
alter table public.payment_vouchers enable row level security;
alter table public.payments enable row level security;
alter table public.employee_ledgers enable row level security;

drop policy if exists "expense categories visible to authenticated users" on public.expense_categories;
create policy "expense categories visible to authenticated users"
on public.expense_categories for select
to authenticated
using (status = 'active');

drop policy if exists "expense categories managed by admin roles" on public.expense_categories;
create policy "expense categories managed by admin roles"
on public.expense_categories for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "claims visible by ownership or role" on public.claims;
create policy "claims visible by ownership or role"
on public.claims for select
to authenticated
using (
  deleted_at is null
  and (
    user_id = auth.uid()
    or public.current_user_role() in ('manager', 'admin_hr', 'accounts_officer', 'super_admin')
  )
);

drop policy if exists "users create own claims" on public.claims;
create policy "users create own claims"
on public.claims for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "claims updated by owner or workflow roles" on public.claims;
create policy "claims updated by owner or workflow roles"
on public.claims for update
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'accounts_officer', 'super_admin')
)
with check (
  user_id = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'accounts_officer', 'super_admin')
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
      and (
        c.user_id = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'accounts_officer', 'super_admin')
      )
  )
);

drop policy if exists "claim child rows managed by claim owner or workflow roles" on public.claim_items;
create policy "claim child rows managed by claim owner or workflow roles"
on public.claim_items for all
to authenticated
using (
  exists (
    select 1
    from public.claims c
    where c.id = claim_id
      and (
        c.user_id = auth.uid()
        or public.current_user_role() in ('admin_hr', 'super_admin')
      )
  )
)
with check (
  exists (
    select 1
    from public.claims c
    where c.id = claim_id
      and (
        c.user_id = auth.uid()
        or public.current_user_role() in ('admin_hr', 'super_admin')
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
      and (
        c.user_id = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'accounts_officer', 'super_admin')
      )
  )
);

drop policy if exists "claim attachments inserted by claim owner" on public.claim_attachments;
create policy "claim attachments inserted by claim owner"
on public.claim_attachments for insert
to authenticated
with check (uploaded_by = auth.uid());

drop policy if exists "claim approvals visible with claim" on public.claim_approvals;
create policy "claim approvals visible with claim"
on public.claim_approvals for select
to authenticated
using (
  exists (
    select 1
    from public.claims c
    where c.id = claim_id
      and (
        c.user_id = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'accounts_officer', 'super_admin')
      )
  )
);

drop policy if exists "claim approvals inserted by workflow roles" on public.claim_approvals;
create policy "claim approvals inserted by workflow roles"
on public.claim_approvals for insert
to authenticated
with check (
  actor_id = auth.uid()
  and public.current_user_role() in ('manager', 'admin_hr', 'accounts_officer', 'super_admin', 'site_staff')
);

drop policy if exists "vouchers visible to finance roles and claim owner" on public.payment_vouchers;
create policy "vouchers visible to finance roles and claim owner"
on public.payment_vouchers for select
to authenticated
using (
  public.current_user_role() in ('admin_hr', 'accounts_officer', 'super_admin')
  or exists (
    select 1 from public.claims c
    where c.id = claim_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "vouchers managed by finance roles" on public.payment_vouchers;
create policy "vouchers managed by finance roles"
on public.payment_vouchers for all
to authenticated
using (public.current_user_role() in ('accounts_officer', 'super_admin'))
with check (public.current_user_role() in ('accounts_officer', 'super_admin'));

drop policy if exists "payments visible to finance roles" on public.payments;
create policy "payments visible to finance roles"
on public.payments for select
to authenticated
using (public.current_user_role() in ('admin_hr', 'accounts_officer', 'super_admin'));

drop policy if exists "payments managed by finance roles" on public.payments;
create policy "payments managed by finance roles"
on public.payments for all
to authenticated
using (public.current_user_role() in ('accounts_officer', 'super_admin'))
with check (public.current_user_role() in ('accounts_officer', 'super_admin'));

drop policy if exists "ledger visible by owner or finance roles" on public.employee_ledgers;
create policy "ledger visible by owner or finance roles"
on public.employee_ledgers for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('admin_hr', 'accounts_officer', 'super_admin')
);

drop policy if exists "ledger managed by finance roles" on public.employee_ledgers;
create policy "ledger managed by finance roles"
on public.employee_ledgers for all
to authenticated
using (public.current_user_role() in ('accounts_officer', 'super_admin'))
with check (public.current_user_role() in ('accounts_officer', 'super_admin'));

insert into public.expense_categories (id, name, description, requires_bill, status)
values
  ('travel', 'Travel', 'Local travel, conveyance and inter-city movement.', false, 'active'),
  ('materials', 'Materials', 'Small consumables and urgent site purchases.', true, 'active'),
  ('food', 'Food & Refreshments', 'Approved meals and refreshments for site work.', false, 'active'),
  ('lodging', 'Lodging', 'Hotel and temporary accommodation.', true, 'active'),
  ('tools', 'Tools & Repairs', 'Small tools, emergency repairs and hire items.', true, 'active'),
  ('misc', 'Miscellaneous', 'Approved project-related expenses.', false, 'active')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  requires_bill = excluded.requires_bill,
  status = excluded.status;
