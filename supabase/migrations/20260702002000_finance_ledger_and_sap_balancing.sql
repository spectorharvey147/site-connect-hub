create or replace function public.add_employee_advance(
  p_employee_id uuid, p_type text, p_date date, p_amount numeric,
  p_reference text, p_remarks text
)
returns uuid language plpgsql security definer set search_path=public as $$
declare org uuid; advance_id uuid; prior numeric; ledger_type text;
begin
  if public.current_user_role() not in ('accounts_officer','super_admin') then raise exception 'Permission denied'; end if;
  if p_amount<=0 or p_type not in ('opening_balance','rolling_advance','temporary_advance','adjustment') then raise exception 'Invalid advance'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_employee_id::text,0));
  select organization_id into org from public.user_profiles where id=p_employee_id;
  if org is null then raise exception 'Employee not found'; end if;
  select coalesce(balance_after,0) into prior from public.employee_ledger_entries where employee_id=p_employee_id order by entry_date desc,created_at desc limit 1;
  insert into public.employee_advances(organization_id,employee_id,advance_type,advance_date,amount,reference_number,remarks,created_by)
  values(org,p_employee_id,p_type,p_date,p_amount,p_reference,p_remarks,auth.uid()) returning id into advance_id;
  ledger_type := case when p_type='opening_balance' then 'opening_balance' when p_type='adjustment' then 'manual_adjustment' else 'advance_added' end;
  insert into public.employee_ledger_entries(organization_id,employee_id,entry_date,entry_type,reference_type,reference_id,debit_amount,credit_amount,balance_after,remarks,created_by)
  values(org,p_employee_id,p_date,ledger_type,case when p_type='adjustment' then 'adjustment' else 'advance' end,advance_id,0,p_amount,coalesce(prior,0)+p_amount,p_remarks,auth.uid());
  return advance_id;
end $$;
revoke all on function public.add_employee_advance(uuid,text,date,numeric,text,text) from public;
grant execute on function public.add_employee_advance(uuid,text,date,numeric,text,text) to authenticated;

drop index if exists public.uq_sap_batch_voucher_claim;
create unique index uq_sap_batch_voucher_claim_side
  on public.claim_sap_export_items(sap_batch_id,voucher_id,claim_id,debit_credit);

create or replace function public.balance_claim_sap_batch()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.debit_credit='debit' then
    insert into public.claim_sap_export_items(
      sap_batch_id,voucher_id,claim_id,employee_id,project_id,customer_id,cost_code_id,
      expense_category_id,sap_gl_code,sap_cost_center,sap_profit_center,
      sap_vendor_or_employee_code,posting_date,document_date,amount,debit_credit,narration
    ) values(
      new.sap_batch_id,new.voucher_id,new.claim_id,new.employee_id,new.project_id,new.customer_id,new.cost_code_id,
      new.expense_category_id,'EMPLOYEE_PAYABLE',new.sap_cost_center,new.sap_profit_center,
      new.sap_vendor_or_employee_code,new.posting_date,new.document_date,new.amount,'credit',
      'Employee payable clearing - '||coalesce(new.narration,'claim')
    ) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists balance_claim_sap_batch on public.claim_sap_export_items;
create trigger balance_claim_sap_batch after insert on public.claim_sap_export_items
for each row execute function public.balance_claim_sap_batch();
