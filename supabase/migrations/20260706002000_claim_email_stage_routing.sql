-- Keep email approvals on the same HOD/default and exceptional-master route as web approvals.

create or replace function public.create_claim_email_action_token(
  p_claim_id uuid, p_approver uuid, p_role text, p_scope text, p_expires_hours int default 48
)
returns text language plpgsql security definer set search_path=public as $$
declare raw text:=encode(gen_random_bytes(32),'hex'); org uuid; claim_state text; target_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select organization_id,status::text into org,claim_state from public.claims where id=p_claim_id;
  select role_id into target_role from public.user_profiles where id=p_approver and organization_id=org and status='active' and deleted_at is null;
  if target_role is null or target_role<>p_role then raise exception 'Approver is invalid'; end if;
  if not (
    (p_scope='admin_verify' and claim_state='admin_verification_pending' and target_role='admin_hr') or
    (p_scope='manager_approve' and claim_state='manager_approval_pending' and target_role='manager' and p_approver=(select reporting_manager_id from public.claims where id=p_claim_id)) or
    (p_scope='hod_approve' and claim_state='hod_approval_pending' and target_role='hod' and p_approver=(select hod_user_id from public.claims where id=p_claim_id)) or
    (p_scope='super_admin_approve' and claim_state='final_approval_pending' and target_role='super_admin') or
    (p_scope='accounts_verify' and claim_state='accounts_verification_pending' and target_role='accounts_officer')
  ) then raise exception 'Action scope does not match the assigned claim stage'; end if;
  update public.claim_email_action_tokens set used_at=now(),used_action='superseded'
    where claim_id=p_claim_id and approver_user_id=p_approver and action_scope=p_scope and used_at is null;
  insert into public.claim_email_action_tokens(organization_id,claim_id,approver_user_id,approver_role,action_scope,token_hash,expires_at)
  values(org,p_claim_id,p_approver,p_role,p_scope,encode(digest(raw,'sha256'),'hex'),now()+make_interval(hours=>least(greatest(p_expires_hours,1),168)));
  return raw;
end $$;

revoke all on function public.create_claim_email_action_token(uuid,uuid,text,text,int) from public;
grant execute on function public.create_claim_email_action_token(uuid,uuid,text,text,int) to authenticated;

create or replace function public.use_claim_email_action(p_token text,p_action text,p_remarks text default null)
returns text language plpgsql security definer set search_path=public as $$
declare t public.claim_email_action_tokens%rowtype; c public.claims%rowtype; next_status text; expected_status text; requires_master boolean:=false;
begin
 select * into t from public.claim_email_action_tokens where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
 if not found or t.used_at is not null or t.expires_at<=now() then raise exception 'This action link is invalid, expired, or already used'; end if;
 if p_action not in ('approve','reject','request_changes','verify') then raise exception 'Invalid action'; end if;
 if p_action in ('reject','request_changes') and nullif(btrim(p_remarks),'') is null then raise exception 'Remarks are required'; end if;
 select * into c from public.claims where id=t.claim_id for update;
 expected_status:=case t.action_scope when 'admin_verify' then 'admin_verification_pending' when 'manager_approve' then 'manager_approval_pending' when 'hod_approve' then 'hod_approval_pending' when 'super_admin_approve' then 'final_approval_pending' when 'accounts_verify' then 'accounts_verification_pending' end;
 if expected_status is null or c.status::text<>expected_status then raise exception 'This action link no longer matches the current claim stage'; end if;
 if t.action_scope='hod_approve' then
   select exists(select 1 from public.approval_matrices m where m.organization_id=c.organization_id and m.workflow_type='claim' and m.is_active and (m.department_id is null or m.department_id=c.department_id) and (m.project_id is null or m.project_id=c.project_id) and ('super_admin' in (m.level_1_role,m.level_2_role,m.level_3_role,m.level_4_role,m.final_approval_role))) into requires_master;
 end if;
 next_status:=case when p_action='reject' then 'rejected' when p_action='request_changes' then 'changes_requested' when t.action_scope='admin_verify' then 'manager_approval_pending' when t.action_scope='manager_approve' then 'hod_approval_pending' when t.action_scope='hod_approve' and requires_master then 'final_approval_pending' when t.action_scope in ('hod_approve','super_admin_approve') then 'accounts_verification_pending' when t.action_scope='accounts_verify' then 'voucher_pending' end;
 update public.claims set status=next_status::public.claim_status,updated_at=now() where id=c.id;
 update public.claim_email_action_tokens set used_at=now(),used_action=p_action,used_ip=inet_client_addr() where id=t.id;
 insert into public.claim_approvals(claim_id,organization_id,department_id,stage,decision,actor_id,actor_role,actor_name,remarks,amount_before,amount_after)
 values(c.id,c.organization_id,c.department_id,case t.action_scope when 'admin_verify' then 'admin_verification' when 'manager_approve' then 'manager_approval' when 'hod_approve' then 'hod_approval' when 'super_admin_approve' then 'final_approval' else 'accounts_verification' end,case when p_action='request_changes' then 'changes_requested' when p_action='reject' then 'rejected' else 'approved' end,t.approver_user_id,t.approver_role,(select full_name from public.user_profiles where id=t.approver_user_id),p_remarks,c.total_approved,c.total_approved);
 return next_status;
end $$;

revoke all on function public.use_claim_email_action(text,text,text) from public;
grant execute on function public.use_claim_email_action(text,text,text) to anon,authenticated;
notify pgrst, 'reload schema';
