-- Payment status CASE expressions are text unless their branches are cast.
create or replace function public.record_claim_payment(p_voucher_id uuid,p_amount numeric,p_date date,p_mode text,p_reference text,p_bank text,p_remarks text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v public.claim_payment_vouchers%rowtype;paid numeric;payment_id uuid;prior numeric;remaining numeric;
begin
 if public.current_user_role() not in ('accounts_officer','super_admin') then raise exception 'Permission denied';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_voucher_id::text,0));
 select * into v from public.claim_payment_vouchers where id=p_voucher_id for update;
 if v.id is null then raise exception 'Voucher not found';end if;
 select coalesce(sum(payment_amount),0) into paid from public.claim_payments where voucher_id=p_voucher_id;
 if p_amount<=0 or paid+p_amount>v.net_payable_amount then raise exception 'Payment exceeds outstanding voucher amount';end if;
 if exists(select 1 from public.claim_accounts_verifications av join public.claim_payment_voucher_items i on i.claim_id=av.claim_id where i.voucher_id=p_voucher_id and av.requires_sap_export and av.sap_export_status<>'exported') then raise exception 'SAP export is required before payment';end if;
 insert into public.claim_payments(organization_id,voucher_id,batch_id,employee_id,payment_date,payment_amount,payment_mode,payment_reference,bank_name,remarks,created_by)
 values(v.organization_id,v.id,v.batch_id,v.employee_id,p_date,p_amount,p_mode,p_reference,p_bank,p_remarks,auth.uid()) returning id into payment_id;
 remaining:=v.net_payable_amount-paid-p_amount;
 update public.claim_payment_vouchers set payment_status=case when remaining=0 then 'paid' else 'partially_paid' end,payment_reference=p_reference,payment_mode=p_mode,payment_date=p_date,updated_at=now() where id=v.id;
 update public.claims set status=case when remaining=0 then 'paid'::public.claim_status else 'partially_paid'::public.claim_status end,paid_at=case when remaining=0 then now() else paid_at end,updated_at=now() where id in(select claim_id from public.claim_payment_voucher_items where voucher_id=v.id);
 select coalesce(balance_after,0) into prior from public.employee_ledger_entries where employee_id=v.employee_id order by entry_date desc,created_at desc limit 1;
 insert into public.employee_ledger_entries(organization_id,employee_id,entry_type,reference_type,reference_id,debit_amount,credit_amount,balance_after,remarks,created_by)
 values(v.organization_id,v.employee_id,case when remaining=0 then 'payment_processed' else 'partial_payment' end,'payment',payment_id,0,p_amount,coalesce(prior,0)-p_amount,p_remarks,auth.uid());
 return payment_id;
end $$;
revoke all on function public.record_claim_payment(uuid,numeric,date,text,text,text,text) from public;
grant execute on function public.record_claim_payment(uuid,numeric,date,text,text,text,text) to authenticated;
