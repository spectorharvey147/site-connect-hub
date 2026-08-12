alter type public.claim_status add value if not exists 'on_hold';

create table if not exists public.claim_master_interventions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  claim_id uuid not null references public.claims(id) on delete cascade,
  action text not null check (action in ('place_on_hold','return_to_admin','return_to_manager','return_to_hod','cancel_claim','release_hold')),
  reason text not null check (length(btrim(reason)) > 0),
  old_status text not null,
  new_status text not null,
  actor_id uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now()
);
alter table public.claim_master_interventions enable row level security;
create policy "master interventions visible in organization" on public.claim_master_interventions for select to authenticated
using (organization_id=public.current_organization_id() and public.current_user_role() in ('admin_hr','accounts_officer','super_admin'));

create or replace function public.master_intervene_claim(p_claim_id uuid,p_action text,p_reason text)
returns text language plpgsql security definer set search_path=public as $$
declare c public.claims%rowtype; target text; previous text;
begin
 if public.current_user_role()<>'super_admin' then raise exception 'Master Intervention requires Super Admin'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'A reason is mandatory'; end if;
 select * into c from public.claims where id=p_claim_id and organization_id=public.current_organization_id() for update;
 if not found then raise exception 'Claim not found'; end if;
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
