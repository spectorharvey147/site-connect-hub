insert into storage.buckets(id,name,public) values('user-signatures','user-signatures',false) on conflict(id) do update set public=false;
create policy "signature objects visible to organization" on storage.objects for select to authenticated using(bucket_id='user-signatures' and ((storage.foldername(name))[1]=public.current_organization_id()::text or public.current_user_role()='super_admin'));
create policy "signature objects uploaded by authorized users" on storage.objects for insert to authenticated with check(bucket_id='user-signatures' and (storage.foldername(name))[1]=public.current_organization_id()::text and (public.current_user_role() in ('admin_hr','super_admin') or (storage.foldername(name))[2]=auth.uid()::text));

create or replace function public.add_employee_advance(p_employee_id uuid,p_type text,p_date date,p_amount numeric,p_reference text,p_remarks text)
returns uuid language plpgsql security definer set search_path=public as $$
declare org uuid; advance_id uuid; prior numeric;
begin
 if public.current_user_role() not in ('accounts_officer','super_admin') then raise exception 'Permission denied'; end if;
 if p_amount<=0 or p_type not in ('opening_balance','rolling_advance','temporary_advance','adjustment') then raise exception 'Invalid advance'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_employee_id::text,0));
 select organization_id into org from public.user_profiles where id=p_employee_id;
 select coalesce(balance_after,0) into prior from public.employee_ledger_entries where employee_id=p_employee_id order by entry_date desc,created_at desc limit 1;
 insert into public.employee_advances(organization_id,employee_id,advance_type,advance_date,amount,reference_number,remarks,created_by) values(org,p_employee_id,p_type,p_date,p_amount,p_reference,p_remarks,auth.uid()) returning id into advance_id;
 insert into public.employee_ledger_entries(organization_id,employee_id,entry_date,entry_type,reference_type,reference_id,debit_amount,credit_amount,balance_after,remarks,created_by)
 values(org,p_employee_id,p_date,'advance_added','advance',advance_id,0,p_amount,coalesce(prior,0)+p_amount,p_remarks,auth.uid());
 return advance_id;
end $$; grant execute on function public.add_employee_advance(uuid,text,date,numeric,text,text) to authenticated;

create or replace function public.record_claim_payment(p_voucher_id uuid,p_amount numeric,p_date date,p_mode text,p_reference text,p_bank text,p_remarks text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v public.claim_payment_vouchers%rowtype; paid numeric; payment_id uuid; prior numeric; remaining numeric;
begin
 if public.current_user_role() not in ('accounts_officer','super_admin') then raise exception 'Permission denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_voucher_id::text,0)); select * into v from public.claim_payment_vouchers where id=p_voucher_id for update;
 select coalesce(sum(payment_amount),0) into paid from public.claim_payments where voucher_id=p_voucher_id;
 if p_amount<=0 or paid+p_amount>v.net_payable_amount then raise exception 'Payment exceeds outstanding voucher amount'; end if;
 if exists(select 1 from public.claim_accounts_verifications av join public.claim_payment_voucher_items i on i.claim_id=av.claim_id where i.voucher_id=p_voucher_id and av.requires_sap_export and av.sap_export_status<>'exported') then raise exception 'SAP export is required before payment'; end if;
 insert into public.claim_payments(organization_id,voucher_id,batch_id,employee_id,payment_date,payment_amount,payment_mode,payment_reference,bank_name,remarks,created_by) values(v.organization_id,v.id,v.batch_id,v.employee_id,p_date,p_amount,p_mode,p_reference,p_bank,p_remarks,auth.uid()) returning id into payment_id;
 remaining:=v.net_payable_amount-paid-p_amount; update public.claim_payment_vouchers set payment_status=case when remaining=0 then 'paid' else 'partially_paid' end,payment_reference=p_reference,payment_mode=p_mode,payment_date=p_date,updated_at=now() where id=v.id;
 update public.claims set status=case when remaining=0 then 'paid' else 'partially_paid' end,paid_at=case when remaining=0 then now() else paid_at end,updated_at=now() where id in(select claim_id from public.claim_payment_voucher_items where voucher_id=v.id);
 select coalesce(balance_after,0) into prior from public.employee_ledger_entries where employee_id=v.employee_id order by entry_date desc,created_at desc limit 1;
 insert into public.employee_ledger_entries(organization_id,employee_id,entry_type,reference_type,reference_id,debit_amount,credit_amount,balance_after,remarks,created_by) values(v.organization_id,v.employee_id,case when remaining=0 then 'payment_processed' else 'partial_payment' end,'payment',payment_id,0,p_amount,coalesce(prior,0)-p_amount,p_remarks,auth.uid()); return payment_id;
end $$; grant execute on function public.record_claim_payment(uuid,numeric,date,text,text,text,text) to authenticated;

create or replace function public.create_claim_email_action_token(p_claim_id uuid,p_approver uuid,p_role text,p_scope text,p_expires_hours int default 48)
returns text language plpgsql security definer set search_path=public as $$
declare raw text:=encode(gen_random_bytes(32),'hex'); org uuid;
begin
 if auth.uid() is null or (auth.uid()<>p_approver and public.current_user_role() not in ('admin_hr','super_admin')) then raise exception 'Permission denied'; end if;
 select organization_id into org from public.claims where id=p_claim_id;
 insert into public.claim_email_action_tokens(organization_id,claim_id,approver_user_id,approver_role,action_scope,token_hash,expires_at) values(org,p_claim_id,p_approver,p_role,p_scope,encode(digest(raw,'sha256'),'hex'),now()+make_interval(hours=>least(greatest(p_expires_hours,1),168)));
 insert into public.audit_logs(organization_id,user_id,actor_user_id,action,entity_type,entity_id,new_values) values(org,auth.uid(),auth.uid(),'claims.email_token_generated','claim',p_claim_id,jsonb_build_object('scope',p_scope,'expiresHours',p_expires_hours)); return raw;
end $$; grant execute on function public.create_claim_email_action_token(uuid,uuid,text,text,int) to authenticated;

create or replace function public.get_claim_email_action(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.claim_email_action_tokens%rowtype;c public.claims%rowtype;
begin select * into t from public.claim_email_action_tokens where token_hash=encode(digest(p_token,'sha256'),'hex');if not found or t.used_at is not null or t.expires_at<=now() then raise exception 'This action link is invalid, expired, or already used';end if;select * into c from public.claims where id=t.claim_id;return jsonb_build_object('claimId',c.id,'claimNumber',c.claim_number,'title',c.title,'amount',c.total_approved,'scope',t.action_scope,'expiresAt',t.expires_at);end $$; grant execute on function public.get_claim_email_action(text) to anon,authenticated;

create or replace function public.use_claim_email_action(p_token text,p_action text,p_remarks text default null)
returns text language plpgsql security definer set search_path=public as $$
declare t public.claim_email_action_tokens%rowtype;c public.claims%rowtype;next_status text;
begin select * into t from public.claim_email_action_tokens where token_hash=encode(digest(p_token,'sha256'),'hex') for update;if not found or t.used_at is not null or t.expires_at<=now() then raise exception 'This action link is invalid, expired, or already used';end if;if p_action not in ('approve','reject','request_changes','verify') then raise exception 'Invalid action';end if;if p_action in ('reject','request_changes') and nullif(btrim(p_remarks),'') is null then raise exception 'Remarks are required';end if;select * into c from public.claims where id=t.claim_id for update;
 next_status:=case when p_action='reject' then 'rejected' when p_action='request_changes' then 'changes_requested' when t.action_scope='admin_verify' then 'manager_approval_pending' when t.action_scope='manager_approve' then 'final_approval_pending' when t.action_scope in ('hod_approve','super_admin_approve') then 'accounts_verification_pending' when t.action_scope='accounts_verify' then 'voucher_pending' else c.status::text end;
 update public.claims set status=next_status::public.claim_status,updated_at=now() where id=c.id;update public.claim_email_action_tokens set used_at=now(),used_action=p_action,used_ip=inet_client_addr() where id=t.id;
 if t.action_scope='accounts_verify' and p_action in ('approve','verify') then update public.claim_accounts_verifications set verification_status='verified',verified_by=t.approver_user_id,verification_date=now(),payable_amount=c.total_approved,deduction_amount=0,updated_at=now() where claim_id=c.id;end if;
 insert into public.claim_approvals(claim_id,organization_id,department_id,stage,decision,actor_id,actor_role,actor_name,remarks,amount_before,amount_after) values(c.id,c.organization_id,c.department_id,case when t.action_scope='admin_verify' then 'admin_verification' when t.action_scope='manager_approve' then 'manager_approval' when t.action_scope='accounts_verify' then 'accounts_verification' else 'final_approval' end,case when p_action='request_changes' then 'changes_requested' when p_action='reject' then 'rejected' else 'approved' end,t.approver_user_id,t.approver_role,(select full_name from public.user_profiles where id=t.approver_user_id),p_remarks,c.total_approved,c.total_approved);
 insert into public.audit_logs(organization_id,user_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,ip_address) values(c.organization_id,t.approver_user_id,t.approver_user_id,'claims.email_action_used','claim',c.id,jsonb_build_object('status',c.status),jsonb_build_object('status',next_status,'action',p_action,'source','email_link'),inet_client_addr()::text);return next_status;
end $$; grant execute on function public.use_claim_email_action(text,text,text) to anon,authenticated;

create or replace function public.activate_user_signature() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.is_active then update public.user_signatures set is_active=false,updated_at=now() where organization_id=new.organization_id and user_id=new.user_id and id<>new.id and is_active;end if;return new;end $$;
create trigger activate_user_signature before insert or update of is_active on public.user_signatures for each row execute function public.activate_user_signature();

revoke all on function public.add_employee_advance(uuid,text,date,numeric,text,text) from public;
revoke all on function public.record_claim_payment(uuid,numeric,date,text,text,text,text) from public;
revoke all on function public.create_claim_email_action_token(uuid,uuid,text,text,int) from public;
revoke all on function public.get_claim_email_action(text) from public;
revoke all on function public.use_claim_email_action(text,text,text) from public;
grant execute on function public.add_employee_advance(uuid,text,date,numeric,text,text) to authenticated;
grant execute on function public.record_claim_payment(uuid,numeric,date,text,text,text,text) to authenticated;
grant execute on function public.create_claim_email_action_token(uuid,uuid,text,text,int) to authenticated;
grant execute on function public.get_claim_email_action(text) to anon,authenticated;
grant execute on function public.use_claim_email_action(text,text,text) to anon,authenticated;
