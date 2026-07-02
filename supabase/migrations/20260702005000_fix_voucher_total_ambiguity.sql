create or replace function public.generate_claim_payment_voucher(p_claim_ids uuid[], p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_first_claim public.claims%rowtype;
  v_claim_count int;
  v_employee_count int;
  v_voucher_id uuid;
  v_voucher_no text;
  v_total_claimed numeric;
  v_total_verified numeric;
  v_total_payable numeric;
  v_total_deduction numeric;
  v_needs_sap boolean;
begin
  if public.current_user_role() not in ('accounts_officer','super_admin') then
    raise exception 'Voucher generation permission denied';
  end if;
  if coalesce(array_length(p_claim_ids,1),0)=0 then
    raise exception 'Select at least one claim';
  end if;

  select count(*), count(distinct c.user_id), sum(c.total_claimed), sum(c.total_verified),
    sum(av.payable_amount), sum(av.deduction_amount), bool_or(av.requires_sap_export)
  into v_claim_count, v_employee_count, v_total_claimed, v_total_verified,
    v_total_payable, v_total_deduction, v_needs_sap
  from public.claims c
  join public.claim_accounts_verifications av on av.claim_id=c.id
  where c.id=any(p_claim_ids)
    and c.status in ('accounts_verified','voucher_pending')
    and av.verification_status='verified';

  if v_claim_count<>array_length(p_claim_ids,1) then
    raise exception 'Every selected claim must be Accounts verified and voucher pending';
  end if;
  if v_employee_count<>1 then
    raise exception 'Combined vouchers require claims for the same employee';
  end if;

  select c.* into v_first_claim from public.claims c where c.id=p_claim_ids[1] for update;
  v_voucher_no := 'CSV-'||to_char(current_date,'YYYY')||'-'||lpad((
    coalesce((select count(*) from public.claim_payment_vouchers pv where pv.organization_id=v_first_claim.organization_id),0)+1
  )::text,6,'0');

  insert into public.claim_payment_vouchers(
    organization_id,voucher_number,voucher_type,voucher_date,employee_id,employee_name_snapshot,employee_email_snapshot,
    department_id,project_id,customer_id,prepared_by,accounts_user_id,gross_claimed_amount,gross_verified_amount,
    gross_deduction_amount,net_payable_amount,payment_status,notes
  )
  select v_first_claim.organization_id,v_voucher_no,case when v_claim_count=1 then 'single_claim' else 'combined_claim' end,current_date,
    p.id,p.full_name,p.email,v_first_claim.department_id,
    case when count(distinct c.project_id)=1 then v_first_claim.project_id end,
    case when count(distinct c.customer_id)=1 then v_first_claim.customer_id end,
    auth.uid(),auth.uid(),v_total_claimed,v_total_verified,v_total_deduction,v_total_payable,'pending',p_notes
  from public.user_profiles p
  join public.claims c on c.user_id=p.id
  where c.id=any(p_claim_ids)
  group by p.id,p.full_name,p.email
  returning id into v_voucher_id;

  insert into public.claim_payment_voucher_items(
    voucher_id,claim_id,claim_item_id,claim_number,expense_date,expense_category_id,expense_category_snapshot,
    project_id,project_name_snapshot,project_cost_code_id,project_cost_code_snapshot,customer_id,customer_name_snapshot,
    description,bill_reference,with_bill_amount,without_bill_amount,claimed_amount,admin_verified_amount,
    manager_approved_amount,final_approved_amount,deduction_amount,remarks,sort_order
  )
  select v_voucher_id,c.id,i.id,c.claim_number,i.expense_date,i.category_id,ec.name,i.project_id,p.name,i.project_cost_code_id,
    concat_ws(' - ',pc.code,pc.name),c.customer_id,c.customer_name,i.description,i.attachment_link,
    case when i.bill_type='with_bill' then i.amount else 0 end,
    case when i.bill_type='without_bill' then i.amount else 0 end,
    i.amount,i.amount,i.amount,
    case when c.total_claimed=0 then 0 else round(i.amount/c.total_claimed*c.total_approved,2) end,
    case when c.total_claimed=0 then 0 else round(i.amount/c.total_claimed*av.deduction_amount,2) end,
    i.remarks,row_number() over(order by c.claim_number,i.expense_date,i.created_at)
  from public.claims c
  join public.claim_accounts_verifications av on av.claim_id=c.id
  join public.claim_items i on i.claim_id=c.id
  left join public.expense_categories ec on ec.id=i.category_id
  left join public.projects p on p.id=i.project_id
  left join public.project_cost_codes pc on pc.id=i.project_cost_code_id
  where c.id=any(p_claim_ids);

  insert into public.claim_payment_voucher_attachments(voucher_id,claim_id,source_attachment_id,file_name,file_path,mime_type)
  select v_voucher_id,a.claim_id,a.id,a.file_name,a.file_url,a.file_type
  from public.claim_attachments a where a.claim_id=any(p_claim_ids)
  on conflict(voucher_id,source_attachment_id) do nothing;

  update public.claims c
  set status=case when v_needs_sap then 'sap_export_pending'::public.claim_status else 'payment_pending'::public.claim_status end,
    updated_by=auth.uid(),updated_at=now()
  where c.id=any(p_claim_ids);

  insert into public.employee_ledger_entries(
    organization_id,employee_id,entry_type,reference_type,reference_id,debit_amount,credit_amount,balance_after,remarks,created_by
  )
  select v_first_claim.organization_id,v_first_claim.user_id,'voucher_generated','voucher',v_voucher_id,v_total_payable,0,
    coalesce((select ele.balance_after from public.employee_ledger_entries ele where ele.employee_id=v_first_claim.user_id order by ele.entry_date desc,ele.created_at desc limit 1),0),
    'Voucher '||v_voucher_no||' generated',auth.uid()
  on conflict(employee_id,entry_type,reference_type,reference_id) do nothing;

  insert into public.audit_logs(organization_id,user_id,actor_user_id,action,entity_type,entity_id,new_values)
  values(v_first_claim.organization_id,auth.uid(),auth.uid(),'claims.voucher_generated','claim_payment_voucher',v_voucher_id,
    jsonb_build_object('voucherNumber',v_voucher_no,'claimIds',p_claim_ids,'netPayableAmount',v_total_payable,'requiresSapExport',v_needs_sap));
  return v_voucher_id;
end $$;

revoke all on function public.generate_claim_payment_voucher(uuid[],text) from public;
grant execute on function public.generate_claim_payment_voucher(uuid[],text) to authenticated;
notify pgrst, 'reload schema';
