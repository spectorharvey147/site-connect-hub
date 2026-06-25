alter table public.employee_ledgers
  add column if not exists claim_number text,
  add column if not exists voucher_number text;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_number text not null unique,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete set null,
  claim_number text,
  voucher_id uuid references public.payment_vouchers(id) on delete set null,
  voucher_number text,
  transaction_type text not null,
  description text not null,
  amount numeric(12, 2) not null default 0,
  direction text not null default 'none',
  balance_after numeric(12, 2) not null default 0,
  actor_id uuid references public.user_profiles(id),
  actor_role text,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_claim_id on public.transactions(claim_id);
create index if not exists idx_transactions_voucher_id on public.transactions(voucher_id);
create index if not exists idx_transactions_type on public.transactions(transaction_type);
create index if not exists idx_transactions_created_at on public.transactions(created_at);
create index if not exists idx_employee_ledgers_voucher_id on public.employee_ledgers(voucher_id);

alter table public.transactions enable row level security;

drop policy if exists "transactions visible by owner or finance roles" on public.transactions;
create policy "transactions visible by owner or finance roles"
on public.transactions for select
to authenticated
using (
  user_id = auth.uid()
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
    'admin_hr',
    'accounts_officer',
    'super_admin'
  )
);
