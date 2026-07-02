alter table public.sap_gl_mappings
  add column if not exists posting_group text not null default 'other'
  check (posting_group in ('separate','other'));

alter function public.generate_claim_sap_batch(uuid[],text,text)
  rename to generate_claim_sap_batch_raw;

create or replace function public.generate_claim_sap_batch(p_voucher_ids uuid[],p_export_type text,p_remarks text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_batch_id uuid;
begin
  v_batch_id:=public.generate_claim_sap_batch_raw(p_voucher_ids,p_export_type,p_remarks);

  -- The raw generator balances every source item. Rebuild the credit side only
  -- after non-separate categories have been consolidated into Other Expenses.
  delete from public.claim_sap_export_items sei
  where sei.sap_batch_id=v_batch_id and sei.debit_credit='credit';

  with other_groups as (
    select min(sei.id::text)::uuid keep_id,sei.voucher_id,sei.claim_id,
      sum(sei.amount) total_amount,
      (array_agg(sei.sap_gl_code order by sei.id))[1] fallback_gl,
      (array_agg(sei.sap_cost_center order by sei.id))[1] cost_center,
      (array_agg(sei.sap_profit_center order by sei.id))[1] profit_center
    from public.claim_sap_export_items sei
    where sei.sap_batch_id=v_batch_id and sei.debit_credit='debit'
      and not exists(
        select 1 from public.sap_gl_mappings m
        join public.claim_payment_vouchers pv on pv.organization_id=m.organization_id
        where pv.id=sei.voucher_id and m.active and m.posting_group='separate'
          and m.expense_category_id=sei.expense_category_id
      )
    group by sei.voucher_id,sei.claim_id
  )
  update public.claim_sap_export_items sei
  set amount=g.total_amount,expense_category_id=null,
      sap_gl_code=coalesce((select m.sap_gl_code from public.sap_gl_mappings m join public.claim_payment_vouchers pv on pv.organization_id=m.organization_id where pv.id=sei.voucher_id and m.active and m.posting_group='other' and m.expense_category_id is null order by m.created_at limit 1),g.fallback_gl,'OTHER_EXPENSES'),
      sap_cost_center=g.cost_center,sap_profit_center=g.profit_center,
      narration='Other Expenses / Voucher '||(select pv.voucher_number from public.claim_payment_vouchers pv where pv.id=sei.voucher_id)
  from other_groups g where sei.id=g.keep_id;

  delete from public.claim_sap_export_items sei
  where sei.sap_batch_id=v_batch_id and sei.debit_credit='debit'
    and not exists(select 1 from public.sap_gl_mappings m join public.claim_payment_vouchers pv on pv.organization_id=m.organization_id where pv.id=sei.voucher_id and m.active and m.posting_group='separate' and m.expense_category_id=sei.expense_category_id)
    and sei.id::text<>(select min(other.id::text) from public.claim_sap_export_items other where other.sap_batch_id=v_batch_id and other.debit_credit='debit' and other.voucher_id=sei.voucher_id and other.claim_id=sei.claim_id and not exists(select 1 from public.sap_gl_mappings m2 join public.claim_payment_vouchers pv2 on pv2.organization_id=m2.organization_id where pv2.id=other.voucher_id and m2.active and m2.posting_group='separate' and m2.expense_category_id=other.expense_category_id));

  insert into public.claim_sap_export_items(sap_batch_id,voucher_id,claim_id,employee_id,project_id,customer_id,cost_code_id,expense_category_id,sap_gl_code,sap_cost_center,sap_profit_center,sap_vendor_or_employee_code,posting_date,document_date,amount,debit_credit,narration)
  select sei.sap_batch_id,sei.voucher_id,sei.claim_id,sei.employee_id,sei.project_id,sei.customer_id,sei.cost_code_id,sei.expense_category_id,
    'EMPLOYEE_PAYABLE',sei.sap_cost_center,sei.sap_profit_center,sei.sap_vendor_or_employee_code,sei.posting_date,sei.document_date,sei.amount,'credit','Employee payable clearing - '||sei.narration
  from public.claim_sap_export_items sei
  where sei.sap_batch_id=v_batch_id and sei.debit_credit='debit'
  on conflict do nothing;
  return v_batch_id;
end $$;

revoke all on function public.generate_claim_sap_batch_raw(uuid[],text,text) from public,authenticated;
revoke all on function public.generate_claim_sap_batch(uuid[],text,text) from public;
grant execute on function public.generate_claim_sap_batch(uuid[],text,text) to authenticated;
notify pgrst, 'reload schema';
