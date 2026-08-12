-- Lifecycle/system tables that are intentionally event-driven still need
-- representative completed, active, failed, and historical records for QA.
do $$
declare v_org uuid;v_ananya uuid;v_meera uuid;v_arjun uuid;v_kavitha uuid;v_priya uuid;v_rohit uuid;v_project uuid;v_dept uuid;
begin
 select id,organization_id into v_ananya,v_org from public.user_profiles where email='ananya.rao@aureliainfra.in';
 select id into v_meera from public.user_profiles where email='meera.nair@aureliainfra.in';select id into v_arjun from public.user_profiles where email='arjun.menon@aureliainfra.in';
 select id into v_kavitha from public.user_profiles where email='kavitha.iyer@aureliainfra.in';select id,primary_project_id,department_id into v_priya,v_project,v_dept from public.user_profiles where email='priya.kulkarni@aureliainfra.in';
 select id into v_rohit from public.user_profiles where email='rohit.shah@aureliainfra.in';

 insert into public.bootstrap_state(id,status,started_at,completed_at,organization_id,admin_user_id)
 values(true,'complete','2026-07-04 18:00+05:30','2026-07-05 09:00+05:30',v_org,v_ananya)
 on conflict(id) do update set status='complete',completed_at=excluded.completed_at,organization_id=v_org,admin_user_id=v_ananya;
 insert into public.app_sessions(user_id,started_at,expires_at,revoked_at,ip_address,user_agent)
 select v_ananya,'2026-07-05 08:55+05:30','2026-07-05 20:55+05:30','2026-07-05 12:00+05:30','10.20.0.15','Chrome 136 / Windows - QA session'
 where not exists(select 1 from public.app_sessions where user_id=v_ananya and started_at='2026-07-05 08:55+05:30');

 insert into public.department_project_assignments(organization_id,department_id,project_id,assignment_type,start_date,status,created_by,updated_by)
 select p.organization_id,p.primary_department_id,p.id,'primary',p.start_date,'active',v_ananya,v_ananya from public.projects p
 where p.organization_id=v_org and p.primary_department_id is not null and p.deleted_at is null
 on conflict(department_id,project_id,assignment_type,start_date) do update set status='active',updated_by=v_ananya;

 insert into public.approval_matrices(organization_id,workflow_type,department_id,project_id,min_amount,max_amount,level_1_role,level_1_user_id,level_2_role,level_2_user_id,final_approval_role,is_active)
 select v_org,x.workflow,v_dept,case when x.workflow in('claim','material_request','dpr','attendance_correction') then v_project end,x.min_amount,x.max_amount,x.level1,x.user1,x.level2,x.user2,x.final_role,true
 from(values
  ('claim',0::numeric,25000::numeric,'admin',v_meera,'manager',v_arjun,'hod'),
  ('leave',null::numeric,null::numeric,'manager',v_arjun,'hod',v_kavitha,'hod'),
  ('material_request',null::numeric,null::numeric,'manager',v_arjun,'hod',v_kavitha,'store_admin'),
  ('vendor_bill',0::numeric,null::numeric,'admin',v_meera,'finance_head',v_ananya,'accounts'),
  ('dpr',null::numeric,null::numeric,'manager',v_arjun,'hod',v_kavitha,'hod'),
  ('attendance_correction',null::numeric,null::numeric,'manager',v_arjun,'admin',v_meera,'admin')
 )x(workflow,min_amount,max_amount,level1,user1,level2,user2,final_role)
 where not exists(select 1 from public.approval_matrices m where m.organization_id=v_org and m.workflow_type=x.workflow and m.is_active);

 insert into public.approval_delegations(organization_id,from_user_id,delegated_to_user_id,workflow_type,start_date,end_date,reason,status)
 select v_org,v_arjun,v_kavitha,'claim','2026-07-20','2026-07-24','Project Manager attending client design workshop; claim approvals delegated to HOD.','active'
 where not exists(select 1 from public.approval_delegations where from_user_id=v_arjun and delegated_to_user_id=v_kavitha and start_date='2026-07-20');
 insert into public.approval_delegations(organization_id,from_user_id,delegated_to_user_id,workflow_type,start_date,end_date,reason,status)
 select v_org,v_kavitha,v_arjun,'dpr','2026-06-10','2026-06-12','HOD site travel delegation completed.','inactive'
 where not exists(select 1 from public.approval_delegations where from_user_id=v_kavitha and delegated_to_user_id=v_arjun and start_date='2026-06-10');

 insert into public.hierarchy_change_logs(organization_id,user_id,old_department_id,new_department_id,old_reporting_manager_id,new_reporting_manager_id,old_hod_user_id,new_hod_user_id,change_reason,changed_by,changed_at)
 select v_org,v_priya,v_dept,v_dept,v_kavitha,v_arjun,v_kavitha,v_kavitha,'Reporting line aligned to the CMRL UG-03 Project Manager after mobilisation.',v_meera,'2026-04-02 10:00+05:30'
 where not exists(select 1 from public.hierarchy_change_logs where user_id=v_priya and changed_at='2026-04-02 10:00+05:30');

 insert into public.report_exports(report_name,filters,exported_by,exported_at)
 select x.name,x.filters,x.actor,x.at from(values
  ('Monthly Attendance Register',jsonb_build_object('month','2026-06','projectId',v_project),v_meera,'2026-07-01 10:15+05:30'::timestamptz),
  ('Employee Claim Ledger',jsonb_build_object('employeeId',v_priya,'from','2026-04-01','to','2026-07-05'),v_rohit,'2026-07-05 17:00+05:30'::timestamptz),
  ('Project Material Consumption',jsonb_build_object('projectId',v_project,'month','2026-06'),v_arjun,'2026-07-02 09:30+05:30'::timestamptz)
 )x(name,filters,actor,at)
 where not exists(select 1 from public.report_exports e where e.report_name=x.name and e.exported_at=x.at);

 insert into public.user_invitations(full_name,email,phone,role_id,department,manager_id,project_ids,status,invited_by,invited_at,accepted_at,organization_id,employee_code,department_id,reporting_manager_id,hod_user_id,primary_project_id)
 select 'Aarthi Raman','aarthi.raman.invite@aureliainfra.in','+91 98401 22041','site_staff','Projects',v_arjun,array[v_project],'expired',v_meera,'2026-06-01 10:00+05:30',null,v_org,'AIPL-INV-001',v_dept,v_arjun,v_kavitha,v_project
 where not exists(select 1 from public.user_invitations where email='aarthi.raman.invite@aureliainfra.in');

 insert into public.offline_mutations(organization_id,user_id,client_mutation_id,mutation_type,payload,processed_at,result)
 values
 (v_org,v_priya,'offline-attendance-20260623-001','attendance_check_in',jsonb_build_object('projectId',v_project,'capturedAt','2026-06-23T07:02:00+05:30'), '2026-06-23 07:05+05:30',jsonb_build_object('status','processed','serverRecord','attendance')),
 (v_org,v_priya,'offline-dpr-20260624-001','dpr_draft_sync',jsonb_build_object('reportDate','2026-06-24','projectId',v_project),null,null)
 on conflict(user_id,client_mutation_id) do update set processed_at=excluded.processed_at,result=excluded.result;

 insert into public.user_signatures(organization_id,user_id,signature_path,signature_name,uploaded_by,is_active)
 select v_org,p.id,v_org||'/'||p.id||'/signature.png',p.full_name||' approval signature',p.id,true
 from public.user_profiles p where p.organization_id=v_org and p.status='active' and p.deleted_at is null
 on conflict(organization_id,user_id) where is_active do update set signature_path=excluded.signature_path,signature_name=excluded.signature_name;

 insert into public.notification_deliveries(organization_id,notification_id,recipient_user_id,channel,recipient_address,status,provider_message_id,attempts,last_error,next_retry_at)
 select v_org,n.id,p.id,'email',p.email,
  case row_number() over(order by p.employee_code)%3 when 0 then 'failed' when 1 then 'sent' else 'pending' end,
  case when row_number() over(order by p.employee_code)%3=1 then 'gmail-msg-'||left(p.id::text,8) end,
  case when row_number() over(order by p.employee_code)%3=0 then 2 else 1 end,
  case when row_number() over(order by p.employee_code)%3=0 then 'Temporary provider throttling during validation.' end,
  case when row_number() over(order by p.employee_code)%3 in(0,2) then now()+interval '15 minutes' end
 from public.user_profiles p join lateral(select id from public.notifications where user_id=p.id order by created_at desc limit 1)n on true
 where p.organization_id=v_org and p.email is not null
 and not exists(select 1 from public.notification_deliveries d where d.notification_id=n.id and d.channel='email');

 insert into public.sap_cost_center_mappings(organization_id,project_id,department_id,sap_cost_center,sap_profit_center,active)
 select v_org,p.id,p.primary_department_id,'CC-'||replace(p.code,'-',''),'PC-INFRA-SOUTH',true from public.projects p
 where p.organization_id=v_org and p.deleted_at is null and not exists(select 1 from public.sap_cost_center_mappings m where m.organization_id=v_org and m.project_id=p.id);
end $$;
