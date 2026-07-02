drop policy if exists "finance manages accounts verification" on public.claim_accounts_verifications;
create policy "authorized roles manage accounts verification"
on public.claim_accounts_verifications for all to authenticated
using (public.current_user_role() in ('accounts_officer','admin_hr','super_admin'))
with check (public.current_user_role() in ('accounts_officer','admin_hr','super_admin'));

create or replace function public.process_claim_accounts_verification(
  p_claim_id uuid,
  p_action text,
  p_payable_amount numeric,
  p_payment_priority text,
  p_requires_sap_export boolean,
  p_remarks text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  target public.claims%rowtype;
  verification_id uuid;
  role_name text := public.current_user_role();
begin
  if role_name not in ('accounts_officer','admin_hr','super_admin') then
    raise exception 'Accounts verification permission denied';
  end if;
  if p_action not in ('verify','return') then raise exception 'Unsupported accounts action'; end if;
  if p_payment_priority not in ('normal','urgent','hold') then raise exception 'Invalid payment priority'; end if;

  select * into target from public.claims where id=p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if target.status not in ('accounts_verification_pending','accounts_returned') then
    raise exception 'Claim is not awaiting Accounts verification';
  end if;
  if p_action='verify' and (p_payable_amount < 0 or p_payable_amount > target.total_approved) then
    raise exception 'Payable amount cannot exceed final approved amount';
  end if;
  if (p_action='return' or p_payable_amount < target.total_approved) and nullif(btrim(p_remarks),'') is null then
    raise exception 'Accounts remarks are required';
  end if;

  insert into public.claim_accounts_verifications(
    organization_id,claim_id,verified_by,verification_status,verification_date,accounts_remarks,
    payable_amount,deduction_amount,payment_priority,requires_sap_export,sap_export_status
  ) values (
    target.organization_id,target.id,auth.uid(),case when p_action='verify' then 'verified' else 'returned' end,now(),p_remarks,
    case when p_action='verify' then p_payable_amount else target.total_approved end,
    case when p_action='verify' then target.total_approved-p_payable_amount else 0 end,
    p_payment_priority,p_requires_sap_export,case when p_requires_sap_export then 'pending' else 'not_required' end
  ) on conflict(claim_id) do update set
    verified_by=excluded.verified_by,verification_status=excluded.verification_status,verification_date=excluded.verification_date,
    accounts_remarks=excluded.accounts_remarks,payable_amount=excluded.payable_amount,deduction_amount=excluded.deduction_amount,
    payment_priority=excluded.payment_priority,requires_sap_export=excluded.requires_sap_export,
    sap_export_status=excluded.sap_export_status,updated_at=now()
  returning id into verification_id;

  update public.claims set status=case when p_action='verify' then 'voucher_pending'::public.claim_status else 'accounts_returned'::public.claim_status end,
    updated_by=auth.uid(),updated_at=now() where id=target.id;

  insert into public.audit_logs(organization_id,user_id,actor_user_id,action,entity_type,entity_id,old_values,new_values)
  values(target.organization_id,auth.uid(),auth.uid(),
    case when p_action='verify' then 'claims.accounts.verified' else 'claims.accounts.returned' end,
    'claim',target.id,jsonb_build_object('status',target.status,'amount',target.total_approved),
    jsonb_build_object('status',case when p_action='verify' then 'voucher_pending' else 'accounts_returned' end,
      'payableAmount',p_payable_amount,'deductionAmount',greatest(target.total_approved-p_payable_amount,0),
      'priority',p_payment_priority,'requiresSapExport',p_requires_sap_export,'remarks',p_remarks));
  return verification_id;
end $$;
revoke all on function public.process_claim_accounts_verification(uuid,text,numeric,text,boolean,text) from public;
grant execute on function public.process_claim_accounts_verification(uuid,text,numeric,text,boolean,text) to authenticated;
