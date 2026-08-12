-- Super Admin may inspect finance queues but normal Accounts mutations belong
-- to Accounts Officer. Master Intervention remains the exceptional path.
create or replace function public.enforce_accounts_mutation_role()
returns trigger language plpgsql set search_path=public as $$
begin
  if public.current_user_role()<>'accounts_officer' then
    raise exception 'This operational action requires Accounts Officer';
  end if;
  return new;
end $$;

drop trigger if exists claim_voucher_accounts_only on public.claim_payment_vouchers;
create trigger claim_voucher_accounts_only before insert on public.claim_payment_vouchers
for each row execute function public.enforce_accounts_mutation_role();
drop trigger if exists claim_payment_accounts_only on public.claim_payments;
create trigger claim_payment_accounts_only before insert on public.claim_payments
for each row execute function public.enforce_accounts_mutation_role();
drop trigger if exists sap_batch_accounts_only on public.claim_sap_export_batches;
create trigger sap_batch_accounts_only before insert on public.claim_sap_export_batches
for each row execute function public.enforce_accounts_mutation_role();

create or replace function public.enforce_accounts_advance_role()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.entry_type in ('opening_balance','advance_added','advance_adjustment')
     and public.current_user_role()<>'accounts_officer' then
    raise exception 'Advance ledger actions require Accounts Officer';
  end if;
  return new;
end $$;
drop trigger if exists employee_advance_accounts_only on public.employee_ledger_entries;
create trigger employee_advance_accounts_only before insert on public.employee_ledger_entries
for each row execute function public.enforce_accounts_advance_role();
