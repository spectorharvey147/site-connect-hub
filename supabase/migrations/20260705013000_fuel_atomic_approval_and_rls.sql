create unique index if not exists idx_fuel_stock_ledger_reference_type
  on public.fuel_stock_ledger(reference_id, transaction_type)
  where reference_id is not null;
create unique index if not exists idx_fuel_vendor_ledger_reference_type
  on public.fuel_vendor_ledger(reference_id, transaction_type)
  where reference_id is not null;
create unique index if not exists idx_fuel_cash_expense_receipt
  on public.fuel_cash_expenses(fuel_receipt_id)
  where fuel_receipt_id is not null;

create or replace function public.guard_fuel_status_transition()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor_role text;
begin
  if auth.uid() is null then return new; end if;
  actor_role:=public.current_user_role();
  if old.status='approved' and new.status is distinct from old.status then
    raise exception 'Approved fuel records cannot be reopened';
  end if;
  if new.status='approved' and old.status<>'submitted' then
    raise exception 'Only submitted fuel records can be approved';
  end if;
  if new.status='approved' and actor_role not in ('manager','hod','admin_hr','super_admin') then
    raise exception 'Only an authorised approver can approve fuel records';
  end if;
  if new.approved_by is distinct from old.approved_by and new.approved_by is distinct from auth.uid() then
    raise exception 'approved_by must match the authenticated approver';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_fuel_receipt_transition on public.fuel_receipts;
create trigger guard_fuel_receipt_transition before update on public.fuel_receipts
for each row execute function public.guard_fuel_status_transition();
drop trigger if exists guard_fuel_issue_transition on public.fuel_issues;
create trigger guard_fuel_issue_transition before update on public.fuel_issues
for each row execute function public.guard_fuel_status_transition();

create or replace function public.approve_fuel_receipt(target_receipt_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare receipt public.fuel_receipts%rowtype;
declare actor_id uuid:=auth.uid();
declare actor_role text:=public.current_user_role();
declare stock_balance numeric(14,3):=0;
declare vendor_balance numeric(14,2):=0;
declare ledger_type text;
begin
  if actor_id is null or actor_role not in ('manager','hod','admin_hr','super_admin') then
    raise exception 'Only an authorised approver can approve fuel receipts';
  end if;
  select * into receipt from public.fuel_receipts where id=target_receipt_id for update;
  if not found then raise exception 'Fuel receipt not found'; end if;
  if receipt.status<>'submitted' then raise exception 'Only submitted fuel receipts can be approved'; end if;
  if receipt.quantity<=0 or receipt.rate_per_unit<=0 or receipt.total_amount<>round(receipt.quantity*receipt.rate_per_unit,2) then
    raise exception 'Fuel receipt quantity, rate, or total is invalid';
  end if;
  select coalesce(balance_quantity,0) into stock_balance from public.fuel_stock_ledger
    where project_id=receipt.project_id and fuel_type=receipt.fuel_type
    order by transaction_date desc,created_at desc limit 1;
  select coalesce(balance_after,0) into vendor_balance from public.fuel_vendor_ledger
    where project_id=receipt.project_id and vendor_id=receipt.vendor_id
    order by transaction_date desc,created_at desc limit 1;
  if receipt.source='advance' and receipt.total_amount>vendor_balance then
    raise exception 'Fuel receipt amount exceeds available vendor advance';
  end if;

  ledger_type:=case receipt.source when 'advance' then 'advance_receipt' when 'credit' then 'credit_receipt' else 'cash_receipt' end;
  insert into public.fuel_stock_ledger(
    organization_id,project_id,department_id,fuel_type,transaction_date,transaction_type,
    reference_id,quantity_in,quantity_out,balance_quantity,unit_rate,status,created_by
  ) values(receipt.organization_id,receipt.project_id,receipt.department_id,receipt.fuel_type,
    receipt.receipt_date,'receipt',receipt.id,receipt.quantity,0,stock_balance+receipt.quantity,
    receipt.rate_per_unit,'posted',actor_id);
  insert into public.fuel_vendor_ledger(
    organization_id,project_id,vendor_id,fuel_contract_id,transaction_date,transaction_type,
    reference_id,debit,credit,balance_after,status,created_by
  ) values(receipt.organization_id,receipt.project_id,receipt.vendor_id,receipt.fuel_contract_id,
    receipt.receipt_date,ledger_type,receipt.id,
    case when receipt.source in ('advance','credit') then receipt.total_amount else 0 end,0,
    case when receipt.source='cash' then vendor_balance else vendor_balance-receipt.total_amount end,
    'posted',actor_id);
  if receipt.source='cash' then
    insert into public.fuel_cash_expenses(
      organization_id,project_id,department_id,vendor_id,fuel_receipt_id,expense_date,
      fuel_type,quantity,rate_per_unit,total_amount,paid_by,payment_mode,payment_reference,
      remarks,status,created_by
    ) values(receipt.organization_id,receipt.project_id,receipt.department_id,receipt.vendor_id,
      receipt.id,receipt.receipt_date,receipt.fuel_type,receipt.quantity,receipt.rate_per_unit,
      receipt.total_amount,actor_id,'cash',receipt.reference_number,receipt.remarks,'approved',actor_id);
  end if;
  update public.fuel_receipts set status='approved',approved_by=actor_id,approved_at=now()
  where id=receipt.id;
  return receipt.id;
end;
$$;

create or replace function public.approve_fuel_issue(target_issue_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare issue public.fuel_issues%rowtype;
declare actor_id uuid:=auth.uid();
declare actor_role text:=public.current_user_role();
declare stock_balance numeric(14,3):=0;
declare row_total numeric(14,3):=0;
begin
  if actor_id is null or actor_role not in ('manager','hod','admin_hr','super_admin') then
    raise exception 'Only an authorised approver can approve fuel issues';
  end if;
  select * into issue from public.fuel_issues where id=target_issue_id for update;
  if not found then raise exception 'Fuel issue not found'; end if;
  if issue.status<>'submitted' then raise exception 'Only submitted fuel issues can be approved'; end if;
  select coalesce(sum(quantity_issued),0) into row_total from public.fuel_issue_rows where fuel_issue_id=issue.id;
  if row_total<=0 or row_total<>issue.total_issued then raise exception 'Fuel issue rows do not reconcile to the header'; end if;
  select coalesce(balance_quantity,0) into stock_balance from public.fuel_stock_ledger
    where project_id=issue.project_id and fuel_type=issue.fuel_type
    order by transaction_date desc,created_at desc limit 1;
  if issue.total_issued>stock_balance then raise exception 'Fuel issue quantity exceeds available stock'; end if;
  insert into public.fuel_stock_ledger(
    organization_id,project_id,department_id,fuel_type,transaction_date,transaction_type,
    reference_id,quantity_in,quantity_out,balance_quantity,status,created_by
  ) values(issue.organization_id,issue.project_id,issue.department_id,issue.fuel_type,
    issue.issue_date,'issue',issue.id,0,issue.total_issued,stock_balance-issue.total_issued,'posted',actor_id);
  update public.fuel_issues set status='approved',approved_by=actor_id,approved_at=now(),
    opening_stock=stock_balance,closing_stock=stock_balance-total_issued where id=issue.id;
  return issue.id;
end;
$$;
revoke all on function public.approve_fuel_receipt(uuid) from public;
revoke all on function public.approve_fuel_issue(uuid) from public;
grant execute on function public.approve_fuel_receipt(uuid) to authenticated;
grant execute on function public.approve_fuel_issue(uuid) to authenticated;

-- Route/service and RLS alignment for HOD review.
drop policy if exists "fuel receipts visible to owner manager or admin" on public.fuel_receipts;
create policy "fuel receipts visible to owner manager or admin" on public.fuel_receipts for select to authenticated
using(deleted_at is null and (submitted_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin')));
drop policy if exists "fuel receipts created by field roles" on public.fuel_receipts;
create policy "fuel receipts created by field roles" on public.fuel_receipts for insert to authenticated
with check(submitted_by=auth.uid() and public.current_user_role() in ('site_staff','manager','hod','admin_hr','super_admin'));
drop policy if exists "fuel receipts updated by owner manager or admin" on public.fuel_receipts;
create policy "fuel receipts updated by owner manager or admin" on public.fuel_receipts for update to authenticated
using(submitted_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin'))
with check(submitted_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin'));

drop policy if exists "fuel issues visible to owner manager or admin" on public.fuel_issues;
create policy "fuel issues visible to owner manager or admin" on public.fuel_issues for select to authenticated
using(deleted_at is null and (submitted_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin')));
drop policy if exists "fuel issues created by field roles" on public.fuel_issues;
create policy "fuel issues created by field roles" on public.fuel_issues for insert to authenticated
with check(submitted_by=auth.uid() and public.current_user_role() in ('site_staff','manager','hod','admin_hr','super_admin'));
drop policy if exists "fuel issues updated by owner manager or admin" on public.fuel_issues;
create policy "fuel issues updated by owner manager or admin" on public.fuel_issues for update to authenticated
using(submitted_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin'))
with check(submitted_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin'));

notify pgrst,'reload schema';
