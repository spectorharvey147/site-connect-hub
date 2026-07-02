-- Idempotent bridge from the original claims-only finance tables.
do $$
declare default_org uuid;
begin
  select id into default_org from public.organizations order by created_at limit 1;

  update public.claims c set organization_id = coalesce(c.organization_id,p.organization_id,default_org)
  from public.user_profiles p where p.id=coalesce(c.requester_user_id,c.user_id) and c.organization_id is null;

  insert into public.claim_accounts_verifications(
    organization_id,claim_id,verified_by,verification_status,verification_date,accounts_remarks,
    payable_amount,deduction_amount,payment_priority,requires_sap_export,sap_export_status,created_at,updated_at
  )
  select c.organization_id,c.id,
    case when c.status in ('voucher_generated','pending_payment','partial_paid','paid') then
      (select a.actor_id from public.claim_approvals a where a.claim_id=c.id and a.stage='accounts_payment' order by a.created_at desc limit 1)
    end,
    case when c.status in ('voucher_generated','pending_payment','partial_paid','paid') then 'verified' else 'pending' end,
    case when c.status in ('voucher_generated','pending_payment','partial_paid','paid') then c.updated_at end,
    'Backfilled from legacy claim workflow',c.total_approved,greatest(c.total_claimed-c.total_approved,0),'normal',false,'not_required',c.created_at,now()
  from public.claims c
  where c.organization_id is not null
    and c.status in ('approved_for_payment','voucher_generated','pending_payment','partial_paid','paid')
  on conflict(claim_id) do nothing;

  -- Previously approved-but-unvouchered claims must now stop at Accounts.
  update public.claims set status='accounts_verification_pending'
  where status='approved_for_payment';

  insert into public.claim_payment_vouchers(
    id,organization_id,voucher_number,voucher_type,voucher_date,employee_id,employee_name_snapshot,
    employee_email_snapshot,department_id,project_id,prepared_by,verified_by,approved_by,accounts_user_id,
    gross_claimed_amount,gross_verified_amount,gross_deduction_amount,net_payable_amount,payment_status,
    payment_reference,payment_date,notes,created_at,updated_at
  )
  select pv.id,coalesce(pv.organization_id,c.organization_id),pv.voucher_number,'single_claim',pv.voucher_date,c.user_id,
    pv.paid_to_name,pv.paid_to_email,pv.department_id,pv.project_id,pv.prepared_by,pv.verified_by,pv.approved_by,pv.prepared_by,
    c.total_claimed,c.total_verified,pv.deduction_amount,pv.net_payable_amount,
    case when pv.status='paid' then 'paid' when pv.status='partial_paid' then 'partially_paid' else 'pending' end,
    pv.payment_reference,pv.paid_at::date,pv.accounts_note,pv.created_at,pv.updated_at
  from public.payment_vouchers pv join public.claims c on c.id=pv.claim_id
  where coalesce(pv.organization_id,c.organization_id) is not null
  on conflict(id) do nothing;

  insert into public.claim_payment_voucher_items(
    voucher_id,claim_id,claim_item_id,claim_number,expense_date,expense_category_id,expense_category_snapshot,
    project_id,project_name_snapshot,project_cost_code_id,project_cost_code_snapshot,description,bill_reference,
    with_bill_amount,without_bill_amount,claimed_amount,admin_verified_amount,manager_approved_amount,
    final_approved_amount,deduction_amount,remarks,sort_order
  )
  select v.id,c.id,i.id,c.claim_number,i.expense_date,i.category_id,ec.name,i.project_id,p.name,i.project_cost_code_id,
    concat_ws(' - ',pc.code,pc.name),i.description,i.attachment_link,
    case when i.bill_type='with_bill' then i.amount else 0 end,case when i.bill_type='without_bill' then i.amount else 0 end,
    i.amount,i.amount,i.amount,i.amount,0,i.remarks,row_number() over(partition by v.id order by i.expense_date,i.created_at)
  from public.claim_payment_vouchers v join public.payment_vouchers legacy on legacy.id=v.id
  join public.claims c on c.id=legacy.claim_id join public.claim_items i on i.claim_id=c.id
  left join public.expense_categories ec on ec.id=i.category_id left join public.projects p on p.id=i.project_id
  left join public.project_cost_codes pc on pc.id=i.project_cost_code_id
  on conflict(voucher_id,claim_id,claim_item_id) do nothing;

  insert into public.employee_ledger_entries(
    organization_id,employee_id,entry_date,entry_type,reference_type,reference_id,debit_amount,credit_amount,balance_after,remarks,created_by
  )
  select c.organization_id,c.user_id,coalesce(c.submitted_at,c.created_at),'claim_submitted','claim',c.id,c.total_claimed,0,
    sum(c.total_claimed) over(partition by c.user_id order by coalesce(c.submitted_at,c.created_at),c.id),
    'Backfilled claim submission',c.created_by
  from public.claims c where c.organization_id is not null and c.status <> 'draft'
  on conflict(employee_id,entry_type,reference_type,reference_id) do nothing;

  insert into public.employee_ledger_entries(
    organization_id,employee_id,entry_date,entry_type,reference_type,reference_id,debit_amount,credit_amount,balance_after,remarks,created_by
  )
  select c.organization_id,c.user_id,coalesce(c.paid_at,c.updated_at),'payment_processed','claim',c.id,0,c.total_approved,0,
    'Backfilled paid claim settlement',c.updated_by
  from public.claims c where c.organization_id is not null and c.status='paid'
  on conflict(employee_id,entry_type,reference_type,reference_id) do nothing;
end $$;
