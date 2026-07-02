-- Final claim-finance hardening: one voucher-ready status, scoped email actions,
-- and durable SAP export files.

update public.claims set status='voucher_pending'::public.claim_status,updated_at=now()
where status='accounts_verified'::public.claim_status;

insert into storage.buckets(id,name,public) values('sap-exports','sap-exports',false)
on conflict(id) do update set public=false;

drop policy if exists "finance reads sap exports" on storage.objects;
create policy "finance reads sap exports" on storage.objects for select to authenticated
using(bucket_id='sap-exports' and ((storage.foldername(name))[1]=public.current_organization_id()::text or public.current_user_role()='super_admin'));
drop policy if exists "finance uploads sap exports" on storage.objects;
create policy "finance uploads sap exports" on storage.objects for insert to authenticated
with check(bucket_id='sap-exports' and (storage.foldername(name))[1]=public.current_organization_id()::text and public.current_user_role() in ('accounts_officer','super_admin'));

alter function public.generate_claim_payment_voucher(uuid[],text)
  rename to generate_claim_payment_voucher_legacy;
create or replace function public.generate_claim_payment_voucher(p_claim_ids uuid[],p_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.claims where id=any(p_claim_ids) and status<>'voucher_pending'::public.claim_status) then
    raise exception 'Every selected claim must be in Voucher Pending';
  end if;
  return public.generate_claim_payment_voucher_legacy(p_claim_ids,p_notes);
end $$;
revoke all on function public.generate_claim_payment_voucher_legacy(uuid[],text) from public,authenticated;
revoke all on function public.generate_claim_payment_voucher(uuid[],text) from public;
grant execute on function public.generate_claim_payment_voucher(uuid[],text) to authenticated;

create or replace function public.use_claim_email_action(p_token text,p_action text,p_remarks text default null)
returns text language plpgsql security definer set search_path=public as $$
declare t public.claim_email_action_tokens%rowtype;c public.claims%rowtype;next_status text;expected_status text;
begin
 select * into t from public.claim_email_action_tokens where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
 if not found or t.used_at is not null or t.expires_at<=now() then raise exception 'This action link is invalid, expired, or already used';end if;
 if p_action not in ('approve','reject','request_changes','verify') then raise exception 'Invalid action';end if;
 if p_action in ('reject','request_changes') and nullif(btrim(p_remarks),'') is null then raise exception 'Remarks are required';end if;
 select * into c from public.claims where id=t.claim_id for update;
 expected_status:=case when t.action_scope='admin_verify' then 'admin_verification_pending' when t.action_scope='manager_approve' then 'manager_approval_pending' when t.action_scope in ('hod_approve','super_admin_approve') then 'final_approval_pending' when t.action_scope='accounts_verify' then 'accounts_verification_pending' end;
 if expected_status is null or c.status::text<>expected_status then raise exception 'This action link no longer matches the current claim stage';end if;
 if p_action='verify' and t.action_scope not in ('admin_verify','accounts_verify') then raise exception 'Verify is not valid for this claim stage';end if;
 next_status:=case when p_action='reject' then 'rejected' when p_action='request_changes' then 'changes_requested' when t.action_scope='admin_verify' then 'manager_approval_pending' when t.action_scope='manager_approve' then 'final_approval_pending' when t.action_scope in ('hod_approve','super_admin_approve') then 'accounts_verification_pending' when t.action_scope='accounts_verify' then 'voucher_pending' end;
 update public.claims set status=next_status::public.claim_status,updated_at=now() where id=c.id;
 update public.claim_email_action_tokens set used_at=now(),used_action=p_action,used_ip=inet_client_addr() where id=t.id;
 if t.action_scope='accounts_verify' and p_action in ('approve','verify') then update public.claim_accounts_verifications set verification_status='verified',verified_by=t.approver_user_id,verification_date=now(),payable_amount=c.total_approved,deduction_amount=0,updated_at=now() where claim_id=c.id;end if;
 insert into public.claim_approvals(claim_id,organization_id,department_id,stage,decision,actor_id,actor_role,actor_name,remarks,amount_before,amount_after) values(c.id,c.organization_id,c.department_id,case when t.action_scope='admin_verify' then 'admin_verification' when t.action_scope='manager_approve' then 'manager_approval' when t.action_scope='accounts_verify' then 'accounts_verification' else 'final_approval' end,case when p_action='request_changes' then 'changes_requested' when p_action='reject' then 'rejected' else 'approved' end,t.approver_user_id,t.approver_role,(select full_name from public.user_profiles where id=t.approver_user_id),p_remarks,c.total_approved,c.total_approved);
 insert into public.audit_logs(organization_id,user_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,ip_address) values(c.organization_id,t.approver_user_id,t.approver_user_id,'claims.email_action_used','claim',c.id,jsonb_build_object('status',c.status),jsonb_build_object('status',next_status,'action',p_action,'scope',t.action_scope,'source','email_link'),inet_client_addr()::text);
 return next_status;
end $$;
revoke all on function public.use_claim_email_action(text,text,text) from public;
grant execute on function public.use_claim_email_action(text,text,text) to anon,authenticated;

notify pgrst, 'reload schema';
