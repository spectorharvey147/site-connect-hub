alter table public.company_settings
  add column if not exists require_hod_approval_claims boolean not null default true,
  add column if not exists super_admin_claim_approval_mode text not null default 'exception_only',
  add column if not exists super_admin_claim_threshold numeric(14,2);

comment on column public.company_settings.require_super_admin_approval_claims
  is 'Deprecated compatibility flag. Use super_admin_claim_approval_mode and super_admin_claim_threshold.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_settings_super_admin_claim_approval_mode_check'
  ) then
    alter table public.company_settings
      add constraint company_settings_super_admin_claim_approval_mode_check
      check (super_admin_claim_approval_mode in ('disabled','exception_only','threshold'));
  end if;
end $$;

create or replace function public.master_intervene_claim(p_claim_id uuid,p_action text,p_reason text)
returns text language plpgsql security definer set search_path=public as $$
declare c public.claims%rowtype; target text; previous text;
begin
 if public.current_user_role()<>'super_admin' then raise exception 'Master Intervention requires Super Admin'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'A reason is mandatory'; end if;
 select * into c from public.claims where id=p_claim_id and organization_id=public.current_organization_id() for update;
 if not found then raise exception 'Claim not found'; end if;
 if c.status::text not in (
   'admin_verification_pending',
   'manager_approval_pending',
   'hod_approval_pending',
   'final_approval_pending',
   'changes_requested',
   'on_hold'
 ) then
   raise exception 'Master Intervention is allowed only before finance processing starts';
 end if;
 previous:=coalesce((select old_status from public.claim_master_interventions where claim_id=c.id and action='place_on_hold' order by created_at desc limit 1),'admin_verification_pending');
 target:=case p_action when 'place_on_hold' then 'on_hold' when 'return_to_admin' then 'admin_verification_pending' when 'return_to_manager' then 'manager_approval_pending' when 'return_to_hod' then 'hod_approval_pending' when 'cancel_claim' then 'cancelled' when 'release_hold' then previous end;
 if target is null then raise exception 'Invalid intervention action'; end if;
 if p_action='release_hold' and c.status::text<>'on_hold' then raise exception 'Only a held claim can be released'; end if;
 update public.claims set status=target::public.claim_status,updated_at=now(),updated_by=auth.uid() where id=c.id;
 insert into public.claim_master_interventions(organization_id,claim_id,action,reason,old_status,new_status,actor_id) values(c.organization_id,c.id,p_action,btrim(p_reason),c.status::text,target,auth.uid());
 insert into public.audit_logs(organization_id,user_id,actor_user_id,actor_role,action,entity_type,entity_id,remarks,old_values,new_values,source) values(c.organization_id,auth.uid(),auth.uid(),'super_admin','claims.master_intervention.'||p_action,'claim',c.id,btrim(p_reason),jsonb_build_object('status',c.status),jsonb_build_object('status',target),'web');
 return target;
end $$;

revoke all on function public.master_intervene_claim(uuid,text,text) from public;
grant execute on function public.master_intervene_claim(uuid,text,text) to authenticated;
