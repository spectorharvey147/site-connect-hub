alter table public.daily_progress_reports
  add column if not exists revision int not null default 0,
  add column if not exists previous_status public.dpr_status;
alter table public.dpr_photos
  alter column file_url drop not null,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text;
create unique index if not exists dpr_photo_storage_uidx on public.dpr_photos(storage_bucket,storage_path) where storage_path is not null;

create table if not exists public.dpr_upload_registry (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references public.user_profiles(id), storage_bucket text not null default 'dpr-photos', storage_path text not null,
  status text not null default 'temporary' check(status in('temporary','attached','cleanup_pending','deleted')),
  dpr_id uuid references public.daily_progress_reports(id) on delete set null, created_at timestamptz not null default now(), finalized_at timestamptz,
  unique(storage_bucket,storage_path)
);
alter table public.dpr_upload_registry enable row level security;
create policy "users register own DPR uploads" on public.dpr_upload_registry for insert to authenticated with check(organization_id=public.current_organization_id() and uploaded_by=auth.uid() and storage_bucket='dpr-photos');
create policy "users see own DPR uploads" on public.dpr_upload_registry for select to authenticated using(organization_id=public.current_organization_id() and (uploaded_by=auth.uid() or public.current_user_role() in('manager','hod','admin_hr','super_admin')));

create or replace function public.save_daily_progress_report(
  p_dpr_id uuid,p_project_id uuid,p_report_date date,p_shift_id text,p_weather text[],p_next_day_plan text,
  p_planned_manpower int,p_planned_equipment text,p_status text,p_activities jsonb,p_issues jsonb,p_photos jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile user_profiles; v_dpr daily_progress_reports; v_id uuid; v_number text; v_item jsonb;
  v_old_status dpr_status; v_revision int:=0; v_labour int:=0; v_completion numeric:=0; v_machines jsonb:='[]';
  v_event text; v_rule communication_event_rules; v_mapping communication_project_mappings; v_outbox_status text;
begin
  select * into v_profile from user_profiles where id=auth.uid() and status='active';
  if not found or v_profile.organization_id is null then raise exception 'Authenticated organization user required'; end if;
  if p_report_date is null or p_report_date>current_date or p_report_date<current_date-interval '31 days' then raise exception 'Report date is outside the allowed window'; end if;
  if p_status not in('draft','submitted') then raise exception 'DPR may only be saved as draft or submitted'; end if;
  if p_planned_manpower<0 then raise exception 'Planned manpower cannot be negative'; end if;
  if jsonb_typeof(coalesce(p_activities,'[]'))<>'array' or jsonb_typeof(coalesce(p_issues,'[]'))<>'array' or jsonb_typeof(coalesce(p_photos,'[]'))<>'array' then raise exception 'DPR details must be arrays'; end if;
  if jsonb_array_length(coalesce(p_photos,'[]'))>10 then raise exception 'A DPR may contain at most 10 photos'; end if;
  if p_status='submitted' and jsonb_array_length(coalesce(p_activities,'[]'))=0 then raise exception 'Submitted DPR requires at least one activity'; end if;
  if not exists(select 1 from projects p where p.id=p_project_id and p.organization_id=v_profile.organization_id and p.status='active' and p.deleted_at is null) then raise exception 'Active project not found in your organization'; end if;
  if not exists(select 1 from user_project_assignments a where a.user_id=auth.uid() and a.project_id=p_project_id and a.status='active' and a.start_date<=p_report_date and (a.end_date is null or a.end_date>=p_report_date)) then raise exception 'Active project assignment required for report date'; end if;

  if p_dpr_id is not null then
    select * into v_dpr from daily_progress_reports where id=p_dpr_id and organization_id=v_profile.organization_id for update;
    if not found or v_dpr.submitted_by<>auth.uid() then raise exception 'DPR edit denied'; end if;
    if v_dpr.status not in('draft','returned') then raise exception 'Only draft or returned DPRs can be edited'; end if;
    v_id:=v_dpr.id; v_number:=v_dpr.dpr_number; v_old_status:=v_dpr.status; v_revision:=v_dpr.revision;
  else
    select * into v_dpr from daily_progress_reports where submitted_by=auth.uid() and project_id=p_project_id and report_date=p_report_date and deleted_at is null and status in('draft','returned') order by updated_at desc limit 1 for update;
    if found then v_id:=v_dpr.id; v_number:=v_dpr.dpr_number; v_old_status:=v_dpr.status; v_revision:=v_dpr.revision;
    else v_id:=gen_random_uuid(); v_number:='DPR-'||to_char(p_report_date,'YYYYMMDD')||'-'||upper(substr(v_id::text,1,8)); v_old_status:=null; end if;
  end if;
  if p_status='submitted' and exists(select 1 from daily_progress_reports d where d.submitted_by=auth.uid() and d.project_id=p_project_id and d.report_date=p_report_date and d.deleted_at is null and d.status<>'draft' and d.id<>v_id) then raise exception 'A submitted DPR already exists for this user, project and date'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_activities,'[]')) loop
    if length(trim(coalesce(v_item->>'description','')))>2000 or coalesce((v_item->>'completionPercent')::numeric,-1) not between 0 and 100 then raise exception 'Invalid DPR activity'; end if;
    if least(coalesce((v_item#>>'{labor,male}')::int,0),coalesce((v_item#>>'{labor,female}')::int,0),coalesce((v_item#>>'{labor,supervisors}')::int,0),coalesce((v_item#>>'{labor,companyStaff}')::int,0))<0 then raise exception 'Labour counts cannot be negative'; end if;
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_issues,'[]')) loop
    if v_item->>'severity' not in('low','medium','high') or v_item->>'status' not in('pending','resolved') or length(trim(coalesce(v_item->>'description',''))) not between 1 and 2000 then raise exception 'Invalid DPR issue'; end if;
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_photos,'[]')) loop
    if v_item->>'storage_bucket'<>'dpr-photos' or nullif(v_item->>'storage_path','') is null or v_item->>'file_type' not in('image/jpeg','image/png','image/webp') or coalesce((v_item->>'file_size')::int,0) not between 1 and 10485760 or length(coalesce(v_item->>'caption',''))>500 then raise exception 'Invalid DPR photo metadata'; end if;
    if split_part(v_item->>'storage_path','/',1)<>v_profile.organization_id::text or split_part(v_item->>'storage_path','/',2)<>auth.uid()::text then raise exception 'DPR photo ownership mismatch'; end if;
  end loop;
  if length(coalesce(p_next_day_plan,''))>4000 then raise exception 'Next-day plan is too long'; end if;

  if v_old_status is null then
    insert into daily_progress_reports(id,organization_id,department_id,dpr_number,project_id,report_date,shift_id,shift_name,submitted_by,weather,next_day_plan,planned_manpower,planned_equipment,status,submitted_at,created_by,revision)
    values(v_id,v_profile.organization_id,v_profile.department_id,v_number,p_project_id,p_report_date,p_shift_id,p_shift_id,auth.uid(),coalesce(p_weather,'{}'),p_next_day_plan,p_planned_manpower,p_planned_equipment,p_status::dpr_status,case when p_status='submitted' then now() end,auth.uid(),case when p_status='submitted' then 1 else 0 end);
    if p_status='submitted' then v_revision:=1; end if;
  else
    if p_status='submitted' then v_revision:=v_revision+1; end if;
    update daily_progress_reports set project_id=p_project_id,report_date=p_report_date,shift_id=p_shift_id,weather=coalesce(p_weather,'{}'),next_day_plan=p_next_day_plan,planned_manpower=p_planned_manpower,planned_equipment=p_planned_equipment,previous_status=status,status=p_status::dpr_status,submitted_at=case when p_status='submitted' then now() else submitted_at end,reviewed_by=null,reviewed_at=null,review_comments=null,revision=v_revision,updated_at=now() where id=v_id;
    delete from dpr_activities where dpr_id=v_id; delete from dpr_issues where dpr_id=v_id; delete from dpr_photos where dpr_id=v_id;
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_activities,'[]')) loop
    insert into dpr_activities(id,dpr_id,activity_name,custom_activity_name,description,completion_percent,machines_used,custom_machines,male_labor,female_labor,supervisors,company_staff,comments)
    values(coalesce((v_item->>'id')::uuid,gen_random_uuid()),v_id,v_item->>'activityName',nullif(v_item->>'customActivityName',''),v_item->>'description',(v_item->>'completionPercent')::int,array(select jsonb_array_elements_text(coalesce(v_item->'machinesUsed','[]'))),coalesce(v_item->'customMachines','[]'),coalesce((v_item#>>'{labor,male}')::int,0),coalesce((v_item#>>'{labor,female}')::int,0),coalesce((v_item#>>'{labor,supervisors}')::int,0),coalesce((v_item#>>'{labor,companyStaff}')::int,0),nullif(v_item->>'comments',''));
    v_labour:=v_labour+coalesce((v_item#>>'{labor,male}')::int,0)+coalesce((v_item#>>'{labor,female}')::int,0)+coalesce((v_item#>>'{labor,supervisors}')::int,0)+coalesce((v_item#>>'{labor,companyStaff}')::int,0);
    v_completion:=v_completion+coalesce((v_item->>'completionPercent')::numeric,0); v_machines:=v_machines||coalesce(v_item->'machinesUsed','[]')||coalesce(v_item->'customMachines','[]');
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_issues,'[]')) loop
    insert into dpr_issues(id,dpr_id,issue_type,severity,description,resolution_notes,status) values(coalesce((v_item->>'id')::uuid,gen_random_uuid()),v_id,v_item->>'issueType',(v_item->>'severity')::dpr_issue_severity,v_item->>'description',nullif(v_item->>'resolutionNotes',''),(v_item->>'status')::dpr_issue_status);
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_photos,'[]')) loop
    insert into dpr_photos(id,dpr_id,file_url,storage_bucket,storage_path,file_name,file_type,file_size,caption,uploaded_by) values(coalesce((v_item->>'id')::uuid,gen_random_uuid()),v_id,null,v_item->>'storage_bucket',v_item->>'storage_path',v_item->>'file_name',v_item->>'file_type',(v_item->>'file_size')::int,nullif(v_item->>'caption',''),auth.uid());
    insert into dpr_upload_registry(organization_id,uploaded_by,storage_bucket,storage_path,status,dpr_id,finalized_at) values(v_profile.organization_id,auth.uid(),v_item->>'storage_bucket',v_item->>'storage_path','attached',v_id,now()) on conflict(storage_bucket,storage_path) do update set status='attached',dpr_id=v_id,finalized_at=now();
  end loop;
  insert into dpr_reports(organization_id,project_id,department_id,daily_progress_report_id,report_number,report_date,weather,labour_count,machinery_used,completion_percentage,issues,next_day_plan,status,created_by,updated_by)
  values(v_profile.organization_id,p_project_id,v_profile.department_id,v_id,v_number,p_report_date,to_jsonb(coalesce(p_weather,'{}')),v_labour,v_machines,case when jsonb_array_length(coalesce(p_activities,'[]'))=0 then 0 else v_completion/jsonb_array_length(p_activities) end,(select string_agg(value->>'description',E'\n') from jsonb_array_elements(coalesce(p_issues,'[]'))),p_next_day_plan,p_status,auth.uid(),auth.uid())
  on conflict(daily_progress_report_id) do update set project_id=excluded.project_id,report_date=excluded.report_date,weather=excluded.weather,labour_count=excluded.labour_count,machinery_used=excluded.machinery_used,completion_percentage=excluded.completion_percentage,issues=excluded.issues,next_day_plan=excluded.next_day_plan,status=excluded.status,updated_by=auth.uid(),updated_at=now();

  if p_status='submitted' then
    v_event:=case when v_old_status='returned' or v_revision>1 then 'dpr.resubmitted' else 'dpr.submitted' end;
    select * into v_rule from communication_event_rules where organization_id=v_profile.organization_id and event_type=v_event and active;
    select * into v_mapping from communication_project_mappings where organization_id=v_profile.organization_id and project_id=p_project_id and active and dpr_enabled;
    v_outbox_status:=case when not found or v_rule.id is null or not v_rule.enabled or v_mapping.id is null then 'suppressed' when v_rule.approval_required or coalesce((select approval_required from communication_settings where organization_id=v_profile.organization_id),true) then 'awaiting_approval' else 'pending' end;
    insert into communication_outbox(organization_id,source_module,event_type,record_id,project_id,actor_user_id,gateway_id,destination,message_type,payload,status,priority,max_attempts,next_attempt_at,idempotency_key)
    values(v_profile.organization_id,'dpr',v_event,v_id,p_project_id,auth.uid(),v_mapping.gateway_id,v_mapping.destination_group_id,coalesce(v_rule.delivery_mode,'image_and_caption'),jsonb_build_object('dpr_id',v_id,'revision',v_revision,'dpr_number',v_number,'report_date',p_report_date),v_outbox_status,coalesce(v_rule.priority,100),coalesce(v_rule.max_attempts,3),now()+make_interval(secs=>coalesce(v_rule.delay_seconds,0)),'dpr:'||v_id||':revision:'||v_revision||':'||v_event) on conflict(organization_id,idempotency_key) do nothing;
  end if;
  insert into audit_logs(user_id,action,entity_type,entity_id,old_values,new_values) values(auth.uid(),case when p_status='submitted' then coalesce(v_event,'dpr.submitted') else 'dpr.draft_saved' end,'daily_progress_report',v_id,jsonb_build_object('status',v_old_status),jsonb_build_object('status',p_status,'revision',v_revision));
  return v_id;
end$$;
revoke all on function public.save_daily_progress_report(uuid,uuid,date,text,text[],text,int,text,text,jsonb,jsonb,jsonb) from public;
grant execute on function public.save_daily_progress_report(uuid,uuid,date,text,text[],text,int,text,text,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.list_dpr_orphan_candidates(p_older_than interval default interval '24 hours')
returns table(storage_bucket text,storage_path text) language sql security definer set search_path=public as $$
  select r.storage_bucket,r.storage_path from dpr_upload_registry r where r.status in('temporary','cleanup_pending') and r.created_at<now()-p_older_than
  and not exists(select 1 from dpr_photos p where p.storage_bucket=r.storage_bucket and p.storage_path=r.storage_path)
$$;
revoke all on function public.list_dpr_orphan_candidates(interval) from public,anon,authenticated;
grant execute on function public.list_dpr_orphan_candidates(interval) to service_role;

create or replace function public.guard_dpr_transition()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor_role text;
begin
  if auth.uid() is null then return new; end if; actor_role:=public.current_user_role();
  if old.status='reviewed' and new.status is distinct from old.status then raise exception 'Reviewed DPRs cannot be reopened'; end if;
  if old.status='returned' and new.status is distinct from old.status and not(new.status in('draft','submitted') and old.submitted_by=auth.uid()) then raise exception 'Returned DPR may only be edited or resubmitted by its original submitter'; end if;
  if new.status in('reviewed','returned') and old.status<>'submitted' then raise exception 'Only submitted DPRs can be reviewed or returned'; end if;
  if new.status in('reviewed','returned') and actor_role not in('manager','hod','super_admin') then raise exception 'Only a scoped operational reviewer can review DPRs'; end if;
  return new;
end$$;

create or replace function public.review_daily_progress_report(target_dpr_id uuid,decision text,comments text)
returns uuid language plpgsql security definer set search_path=public as $$
declare dpr daily_progress_reports; actor user_profiles; mapping communication_project_mappings; rule communication_event_rules; outbox_status text;
begin
  if decision not in('reviewed','returned') then raise exception 'Invalid DPR review decision'; end if;
  select * into actor from user_profiles where id=auth.uid() and status='active';
  if actor.role_id not in('manager','hod','super_admin') then raise exception 'DPR review access denied'; end if;
  select * into dpr from daily_progress_reports where id=target_dpr_id and organization_id=actor.organization_id for update;
  if not found or dpr.status<>'submitted' then raise exception 'Submitted DPR not found'; end if;
  if decision='returned' and length(trim(coalesce(comments,'')))<10 then raise exception 'Return comments must explain the required correction'; end if;
  if actor.role_id='manager' and not exists(select 1 from user_profiles u where u.id=dpr.submitted_by and coalesce(u.reporting_manager_id,u.manager_id)=actor.id) and not exists(select 1 from projects p where p.id=dpr.project_id and p.project_manager_id=actor.id) then raise exception 'Manager project/reporting scope denied'; end if;
  if actor.role_id='hod' and not exists(select 1 from user_profiles u where u.id=dpr.submitted_by and (u.hod_user_id=actor.id or u.department_id=actor.department_id)) then raise exception 'HOD department scope denied'; end if;
  update daily_progress_reports set previous_status=status,status=decision::dpr_status,reviewed_by=actor.id,reviewed_at=now(),review_comments=comments where id=dpr.id;
  update dpr_reports set status=decision,updated_by=actor.id,updated_at=now() where daily_progress_report_id=dpr.id;
  select * into rule from communication_event_rules where organization_id=actor.organization_id and event_type='dpr.'||decision and active;
  select * into mapping from communication_project_mappings where organization_id=actor.organization_id and project_id=dpr.project_id and active and dpr_enabled;
  outbox_status:=case when rule.id is null or not rule.enabled or mapping.id is null then 'suppressed' when rule.approval_required or coalesce((select approval_required from communication_settings where organization_id=actor.organization_id),true) then 'awaiting_approval' else 'pending' end;
  insert into communication_outbox(organization_id,source_module,event_type,record_id,project_id,actor_user_id,gateway_id,destination,message_type,payload,status,priority,max_attempts,next_attempt_at,idempotency_key)
  values(actor.organization_id,'dpr','dpr.'||decision,dpr.id,dpr.project_id,actor.id,mapping.gateway_id,mapping.destination_group_id,coalesce(rule.delivery_mode,'image_and_caption'),jsonb_build_object('dpr_id',dpr.id,'revision',dpr.revision,'decision',decision,'comments',comments),outbox_status,coalesce(rule.priority,100),coalesce(rule.max_attempts,3),now()+make_interval(secs=>coalesce(rule.delay_seconds,0)),'dpr:'||dpr.id||':revision:'||dpr.revision||':dpr.'||decision)
  on conflict(organization_id,idempotency_key) do nothing;
  insert into audit_logs(user_id,action,entity_type,entity_id,old_values,new_values) values(actor.id,'dpr.'||decision,'daily_progress_report',dpr.id,jsonb_build_object('status','submitted'),jsonb_build_object('status',decision,'comments',comments));
  return dpr.id;
end$$;
revoke all on function public.review_daily_progress_report(uuid,text,text) from public;
grant execute on function public.review_daily_progress_report(uuid,text,text) to authenticated;
