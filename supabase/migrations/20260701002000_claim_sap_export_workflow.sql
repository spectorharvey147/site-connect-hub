create or replace function public.generate_claim_sap_batch(p_voucher_ids uuid[],p_export_type text,p_remarks text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare org uuid; batch_id uuid; batch_no text; voucher_count int; claim_count int; total numeric;
begin
  if public.current_user_role() not in ('accounts_officer','super_admin') then raise exception 'SAP export permission denied'; end if;
  if p_export_type not in ('preview','final') then raise exception 'Invalid SAP export type'; end if;
  if coalesce(array_length(p_voucher_ids,1),0)=0 then raise exception 'Select at least one voucher'; end if;
  perform pg_advisory_xact_lock(hashtextextended(array_to_string(p_voucher_ids,','),0));
  select (array_agg(v.organization_id))[1],count(distinct v.id),count(distinct i.claim_id),sum(i.final_approved_amount-i.deduction_amount)
  into org,voucher_count,claim_count,total from public.claim_payment_vouchers v join public.claim_payment_voucher_items i on i.voucher_id=v.id
  where v.id=any(p_voucher_ids);
  if voucher_count<>array_length(p_voucher_ids,1) then raise exception 'Voucher selection is invalid'; end if;
  if p_export_type='final' and exists(select 1 from public.claim_sap_export_items i join public.claim_sap_export_batches b on b.id=i.sap_batch_id where i.voucher_id=any(p_voucher_ids) and b.export_type='final' and b.status<>'cancelled') then raise exception 'A voucher already has an active final SAP export'; end if;
  batch_no:='SAP-'||to_char(current_date,'YYYYMMDD')||'-'||lpad((coalesce((select count(*) from public.claim_sap_export_batches where organization_id=org),0)+1)::text,4,'0');
  insert into public.claim_sap_export_batches(organization_id,sap_batch_number,exported_by,export_type,file_name,total_claims,total_vouchers,total_amount,status,remarks)
  values(org,batch_no,auth.uid(),p_export_type,batch_no||'.csv',claim_count,voucher_count,coalesce(total,0),'generated',p_remarks) returning id into batch_id;
  insert into public.claim_sap_export_items(sap_batch_id,voucher_id,claim_id,employee_id,project_id,customer_id,cost_code_id,expense_category_id,sap_gl_code,sap_cost_center,sap_profit_center,sap_vendor_or_employee_code,posting_date,document_date,amount,debit_credit,narration)
  select batch_id,v.id,i.claim_id,v.employee_id,i.project_id,i.customer_id,i.project_cost_code_id,i.expense_category_id,
    coalesce(g.sap_gl_code,'UNMAPPED'),coalesce(cc.sap_cost_center,g.sap_cost_center,'UNMAPPED'),coalesce(cc.sap_profit_center,g.sap_profit_center),coalesce(p.employee_code,p.employee_id),current_date,v.voucher_date,
    greatest(i.final_approved_amount-i.deduction_amount,0),'debit',concat('Claim ',i.claim_number,' / Voucher ',v.voucher_number)
  from public.claim_payment_vouchers v join public.claim_payment_voucher_items i on i.voucher_id=v.id
  join public.user_profiles p on p.id=v.employee_id
  left join lateral(select * from public.sap_gl_mappings m where m.organization_id=v.organization_id and m.active and (m.expense_category_id is null or m.expense_category_id=i.expense_category_id) and (m.project_cost_code_id is null or m.project_cost_code_id=i.project_cost_code_id) order by (m.expense_category_id is not null)::int+(m.project_cost_code_id is not null)::int desc limit 1) g on true
  left join lateral(select * from public.sap_cost_center_mappings m where m.organization_id=v.organization_id and m.active and (m.project_cost_code_id is null or m.project_cost_code_id=i.project_cost_code_id) order by (m.project_cost_code_id is not null)::int desc limit 1) cc on true
  where v.id=any(p_voucher_ids);
  if p_export_type='final' then
    update public.claims set status='sap_exported',updated_at=now(),updated_by=auth.uid() where id in(select claim_id from public.claim_payment_voucher_items where voucher_id=any(p_voucher_ids));
    update public.claim_accounts_verifications set sap_export_status='exported',updated_at=now() where claim_id in(select claim_id from public.claim_payment_voucher_items where voucher_id=any(p_voucher_ids));
  end if;
  return batch_id;
end $$;
grant execute on function public.generate_claim_sap_batch(uuid[],text,text) to authenticated;

create or replace function public.cancel_claim_sap_batch(p_batch_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if public.current_user_role() not in ('accounts_officer','super_admin') then raise exception 'Permission denied'; end if;
 update public.claim_sap_export_batches set status='cancelled',updated_at=now() where id=p_batch_id and status='generated';
 if not found then raise exception 'Only generated batches can be cancelled'; end if;
 update public.claims set status='sap_export_pending',updated_at=now(),updated_by=auth.uid()
 where id in(select claim_id from public.claim_sap_export_items where sap_batch_id=p_batch_id)
   and not exists(select 1 from public.claim_sap_export_items i join public.claim_sap_export_batches b on b.id=i.sap_batch_id where i.claim_id=claims.id and b.export_type='final' and b.status<>'cancelled');
 update public.claim_accounts_verifications set sap_export_status='pending',updated_at=now()
 where claim_id in(select claim_id from public.claim_sap_export_items where sap_batch_id=p_batch_id);
end $$;
grant execute on function public.cancel_claim_sap_batch(uuid) to authenticated;
