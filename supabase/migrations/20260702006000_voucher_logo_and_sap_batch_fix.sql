alter table public.organizations
  add column if not exists voucher_logo_position text not null default 'left'
    check (voucher_logo_position in ('left','right','hidden')),
  add column if not exists voucher_logo_size integer not null default 18
    check (voucher_logo_size between 12 and 28);

create or replace function public.generate_claim_sap_batch(p_voucher_ids uuid[],p_export_type text,p_remarks text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_org uuid; v_batch_id uuid; v_batch_no text; v_voucher_count int; v_claim_count int; v_total numeric;
begin
  if public.current_user_role() not in ('accounts_officer','super_admin') then raise exception 'SAP export permission denied'; end if;
  if p_export_type not in ('preview','final') then raise exception 'Invalid SAP export type'; end if;
  if coalesce(array_length(p_voucher_ids,1),0)=0 then raise exception 'Select at least one voucher'; end if;
  perform pg_advisory_xact_lock(hashtextextended(array_to_string(p_voucher_ids,','),0));
  select (array_agg(pv.organization_id))[1],count(distinct pv.id),count(distinct pvi.claim_id),sum(pvi.final_approved_amount-pvi.deduction_amount)
  into v_org,v_voucher_count,v_claim_count,v_total
  from public.claim_payment_vouchers pv
  join public.claim_payment_voucher_items pvi on pvi.voucher_id=pv.id
  where pv.id=any(p_voucher_ids);
  if v_voucher_count<>array_length(p_voucher_ids,1) then raise exception 'Voucher selection is invalid'; end if;
  if p_export_type='final' and exists(
    select 1 from public.claim_sap_export_items sei
    join public.claim_sap_export_batches seb on seb.id=sei.sap_batch_id
    where sei.voucher_id=any(p_voucher_ids) and seb.export_type='final' and seb.status<>'cancelled'
  ) then raise exception 'A voucher already has an active final SAP export'; end if;
  v_batch_no:='SAP-'||to_char(current_date,'YYYYMMDD')||'-'||lpad((coalesce((select count(*) from public.claim_sap_export_batches seb where seb.organization_id=v_org),0)+1)::text,4,'0');
  insert into public.claim_sap_export_batches(organization_id,sap_batch_number,exported_by,export_type,file_name,total_claims,total_vouchers,total_amount,status,remarks)
  values(v_org,v_batch_no,auth.uid(),p_export_type,v_batch_no||'.csv',v_claim_count,v_voucher_count,coalesce(v_total,0),'generated',p_remarks)
  returning id into v_batch_id;
  insert into public.claim_sap_export_items(sap_batch_id,voucher_id,claim_id,employee_id,project_id,customer_id,cost_code_id,expense_category_id,sap_gl_code,sap_cost_center,sap_profit_center,sap_vendor_or_employee_code,posting_date,document_date,amount,debit_credit,narration)
  select v_batch_id,pv.id,pvi.claim_id,pv.employee_id,pvi.project_id,pvi.customer_id,pvi.project_cost_code_id,pvi.expense_category_id,
    coalesce(g.sap_gl_code,'UNMAPPED'),coalesce(cc.sap_cost_center,g.sap_cost_center,'UNMAPPED'),coalesce(cc.sap_profit_center,g.sap_profit_center),coalesce(up.employee_code,up.employee_id),current_date,pv.voucher_date,
    greatest(pvi.final_approved_amount-pvi.deduction_amount,0),'debit',concat('Claim ',pvi.claim_number,' / Voucher ',pv.voucher_number)
  from public.claim_payment_vouchers pv
  join public.claim_payment_voucher_items pvi on pvi.voucher_id=pv.id
  join public.user_profiles up on up.id=pv.employee_id
  left join lateral(select * from public.sap_gl_mappings m where m.organization_id=pv.organization_id and m.active and (m.expense_category_id is null or m.expense_category_id=pvi.expense_category_id) and (m.project_cost_code_id is null or m.project_cost_code_id=pvi.project_cost_code_id) order by (m.expense_category_id is not null)::int+(m.project_cost_code_id is not null)::int desc limit 1) g on true
  left join lateral(select * from public.sap_cost_center_mappings m where m.organization_id=pv.organization_id and m.active and (m.project_cost_code_id is null or m.project_cost_code_id=pvi.project_cost_code_id) order by (m.project_cost_code_id is not null)::int desc limit 1) cc on true
  where pv.id=any(p_voucher_ids);
  if p_export_type='final' then
    update public.claims c set status='sap_exported',updated_at=now(),updated_by=auth.uid()
    where c.id in(select pvi.claim_id from public.claim_payment_voucher_items pvi where pvi.voucher_id=any(p_voucher_ids));
    update public.claim_accounts_verifications cav set sap_export_status='exported',updated_at=now()
    where cav.claim_id in(select pvi.claim_id from public.claim_payment_voucher_items pvi where pvi.voucher_id=any(p_voucher_ids));
  end if;
  return v_batch_id;
end $$;
revoke all on function public.generate_claim_sap_batch(uuid[],text,text) from public;
grant execute on function public.generate_claim_sap_batch(uuid[],text,text) to authenticated;
notify pgrst, 'reload schema';
