drop policy if exists "fuel_vendor_deposits_organization_read" on public.fuel_vendor_deposits;
create policy "fuel_vendor_deposits_finance_read" on public.fuel_vendor_deposits for select to authenticated
using(organization_id=public.current_organization_id() and public.current_user_role() in ('manager','hod','accounts_officer','admin_hr','super_admin'));
drop policy if exists "fuel_vendor_deposits_organization_insert" on public.fuel_vendor_deposits;
create policy "fuel_vendor_deposits_finance_insert" on public.fuel_vendor_deposits for insert to authenticated
with check(organization_id=public.current_organization_id() and created_by=auth.uid() and public.current_user_role() in ('manager','hod','accounts_officer','admin_hr','super_admin'));

drop policy if exists "fuel_vendor_ledger_organization_read" on public.fuel_vendor_ledger;
create policy "fuel_vendor_ledger_finance_read" on public.fuel_vendor_ledger for select to authenticated
using(organization_id=public.current_organization_id() and public.current_user_role() in ('manager','hod','accounts_officer','admin_hr','super_admin'));

drop policy if exists "fuel_cash_expenses_read" on public.fuel_cash_expenses;
create policy "fuel_cash_expenses_finance_read" on public.fuel_cash_expenses for select to authenticated
using(organization_id=public.current_organization_id() and public.current_user_role() in ('manager','hod','accounts_officer','admin_hr','super_admin'));

notify pgrst,'reload schema';
