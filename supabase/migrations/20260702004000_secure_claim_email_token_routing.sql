create or replace function public.create_claim_email_action_token(
  p_claim_id uuid, p_approver uuid, p_role text, p_scope text, p_expires_hours int default 48
)
returns text language plpgsql security definer set search_path=public as $$
declare
  raw text:=encode(gen_random_bytes(32),'hex');
  org uuid; owner_id uuid; claim_state text; target_role text; caller_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select organization_id,user_id,status::text into org,owner_id,claim_state from public.claims where id=p_claim_id;
  select role_id into target_role from public.user_profiles where id=p_approver and organization_id=org and status='active';
  caller_role:=public.current_user_role();
  if target_role is null or target_role<>p_role then raise exception 'Approver is invalid'; end if;
  if not (
    (p_scope='admin_verify' and claim_state='admin_verification_pending' and target_role in ('admin_hr','super_admin')) or
    (p_scope='manager_approve' and claim_state='manager_approval_pending' and p_approver=(select reporting_manager_id from public.claims where id=p_claim_id)) or
    (p_scope in ('hod_approve','super_admin_approve') and claim_state='final_approval_pending' and target_role in ('hod','super_admin')) or
    (p_scope='accounts_verify' and claim_state='accounts_verification_pending' and target_role in ('accounts_officer','super_admin'))
  ) then raise exception 'Action scope does not match the claim stage'; end if;
  if not (
    auth.uid()=p_approver or caller_role in ('admin_hr','super_admin') or
    (auth.uid()=owner_id and p_scope='admin_verify') or
    exists(select 1 from public.claim_approvals where claim_id=p_claim_id and actor_id=auth.uid())
  ) then raise exception 'Permission denied'; end if;
  update public.claim_email_action_tokens set used_at=now(),used_action='superseded'
  where claim_id=p_claim_id and approver_user_id=p_approver and action_scope=p_scope and used_at is null;
  insert into public.claim_email_action_tokens(organization_id,claim_id,approver_user_id,approver_role,action_scope,token_hash,expires_at)
  values(org,p_claim_id,p_approver,p_role,p_scope,encode(digest(raw,'sha256'),'hex'),now()+make_interval(hours=>least(greatest(p_expires_hours,1),168)));
  insert into public.audit_logs(organization_id,user_id,actor_user_id,action,entity_type,entity_id,new_values)
  values(org,auth.uid(),auth.uid(),'claims.email_token_generated','claim',p_claim_id,jsonb_build_object('scope',p_scope,'approver',p_approver,'expiresHours',p_expires_hours));
  return raw;
end $$;
revoke all on function public.create_claim_email_action_token(uuid,uuid,text,text,int) from public;
grant execute on function public.create_claim_email_action_token(uuid,uuid,text,text,int) to authenticated;
notify pgrst, 'reload schema';
