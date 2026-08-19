-- Collaboration modules: scoped RLS, task state integrity, and linked scenarios.

create or replace function public.validate_task_state()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.status='completed' then new.progress_percent:=100;new.completed_at:=coalesce(new.completed_at,now());
 elsif new.progress_percent=100 then raise exception 'Only completed tasks can have 100 percent progress';
 elsif new.completed_at is not null then new.completed_at:=null;end if;
 return new;
end $$;
drop trigger if exists validate_task_state on public.tasks;
create trigger validate_task_state before insert or update on public.tasks for each row execute function public.validate_task_state();

drop policy if exists "tasks visible by owner assignee manager or admin" on public.tasks;
create policy "tasks visible by owner assignee manager or admin" on public.tasks for select to authenticated using(
 deleted_at is null and organization_id=public.current_organization_id() and(
 assigned_to=auth.uid() or created_by=auth.uid() or public.current_user_role() in ('admin_hr','super_admin')
 or exists(select 1 from public.user_profiles p where p.id=assigned_to and
  ((public.current_user_role()='manager' and coalesce(p.reporting_manager_id,p.manager_id)=auth.uid())
   or(public.current_user_role()='hod' and p.hod_user_id=auth.uid())))
 ));
drop policy if exists "tasks updated by participants or admin roles" on public.tasks;
create policy "tasks updated by participants or admin roles" on public.tasks for update to authenticated
using(organization_id=public.current_organization_id() and(assigned_to=auth.uid() or created_by=auth.uid() or public.current_user_role() in ('admin_hr','super_admin')
 or exists(select 1 from public.user_profiles p where p.id=assigned_to and((public.current_user_role()='manager' and coalesce(p.reporting_manager_id,p.manager_id)=auth.uid())or(public.current_user_role()='hod' and p.hod_user_id=auth.uid())))))
with check(organization_id=public.current_organization_id() and(assigned_to=auth.uid() or created_by=auth.uid() or public.current_user_role() in ('admin_hr','super_admin')
 or exists(select 1 from public.user_profiles p where p.id=assigned_to and((public.current_user_role()='manager' and coalesce(p.reporting_manager_id,p.manager_id)=auth.uid())or(public.current_user_role()='hod' and p.hod_user_id=auth.uid())))));

alter table public.conversations add column if not exists organization_id uuid references public.organizations(id);
update public.conversations c set organization_id=p.organization_id from public.user_profiles p where p.id=c.created_by and c.organization_id is null;
alter table public.conversations alter column organization_id set not null;
create index if not exists idx_conversations_org on public.conversations(organization_id,updated_at desc);
drop policy if exists "authenticated users create conversations" on public.conversations;
create policy "authenticated users create conversations" on public.conversations for insert to authenticated
with check(created_by=auth.uid() and organization_id=public.current_organization_id());
drop policy if exists "conversation members inserted by creator or admin" on public.conversation_members;
create policy "conversation members inserted by creator or admin" on public.conversation_members for insert to authenticated with check(
 exists(select 1 from public.conversations c join public.user_profiles p on p.id=user_id
 where c.id=conversation_id and c.organization_id=p.organization_id and c.organization_id=public.current_organization_id()
 and(c.created_by=auth.uid() or user_id=auth.uid() or public.current_user_role() in ('admin_hr','super_admin'))));

do $$
declare v_org uuid;v_project uuid;v_arjun uuid;v_kavitha uuid;v_meera uuid;v_rohit uuid;v_priya uuid;v_user record;v_task uuid;v_i int;v_status public.task_status;v_conv uuid;v_msg uuid;
begin
 select id,organization_id,primary_project_id into v_priya,v_org,v_project from public.user_profiles where email='priya.kulkarni@aureliainfra.in';
 select id into v_arjun from public.user_profiles where email='arjun.menon@aureliainfra.in';select id into v_kavitha from public.user_profiles where email='kavitha.iyer@aureliainfra.in';
 select id into v_meera from public.user_profiles where email='meera.nair@aureliainfra.in';select id into v_rohit from public.user_profiles where email='rohit.shah@aureliainfra.in';
 if v_priya is null or v_org is null or v_arjun is null then return; end if;
 for v_i in 1..7 loop
  select * into v_user from public.user_profiles where organization_id=v_org and status='active' and role_id='site_staff' order by employee_code offset (v_i-1)%5 limit 1;
  v_task:=('73000000-0000-4000-8000-'||lpad(v_i::text,12,'0'))::uuid;
  v_status:=case v_i when 1 then 'not_started' when 2 then 'in_progress' when 3 then 'in_progress' when 4 then 'completed' when 5 then 'on_hold' when 6 then 'cancelled' else 'in_progress' end;
  insert into public.tasks(id,task_number,title,description,organization_id,department_id,project_id,created_by,assigned_to,priority,status,due_date,due_time,estimated_hours,progress_percent,reminder_at,completed_at)
  values(v_task,'TSK-2026-'||lpad(v_i::text,4,'0'),case v_i when 1 then 'Verify reinforcement checklist for diaphragm wall' when 2 then 'Close NCR for waterproofing joint' when 3 then 'Update material reconciliation for June' when 4 then 'Complete weekly safety barricade audit' when 5 then 'Coordinate utility diversion shutdown' when 6 then 'Prepare obsolete temporary access proposal' else 'Upload cube-test results and pour card' end,
  'Execution task linked to the CMRL UG-03 site plan with measurable completion evidence.',v_org,v_user.department_id,coalesce(v_user.primary_project_id,v_project),v_arjun,v_user.id,
  (case when v_i in(1,2,5) then 'high' when v_i in(3,7) then 'medium' else 'low' end)::public.task_priority,v_status,date '2026-07-06'+v_i,case when v_i%2=0 then '17:00'::time else '11:00'::time end,4+v_i,
  case v_status when 'not_started' then 0 when 'in_progress' then v_i*10 when 'completed' then 100 when 'on_hold' then 35 else 0 end,now()+v_i*interval '1 day',case when v_status='completed' then now()-interval '2 day' end)
  on conflict(task_number) do update set status=excluded.status,progress_percent=excluded.progress_percent,completed_at=excluded.completed_at;
  insert into public.task_comments(task_id,user_id,comment) values(v_task,v_arjun,'Task scope, acceptance evidence, and due date reviewed with the assignee.') on conflict do nothing;
  if v_status in('in_progress','completed','on_hold') then insert into public.task_comments(task_id,user_id,comment) values(v_task,v_user.id,case v_status when 'completed' then 'Completed and evidence uploaded for review.' when 'on_hold' then 'Paused pending client shutdown approval.' else 'Work started; progress updated after field verification.' end);end if;
  insert into public.task_attachments(task_id,file_url,file_name,file_type,file_size,uploaded_by) values(v_task,'task-documents/2026/'||v_task||'/evidence-'||v_i||'.pdf','Task Evidence '||v_i||'.pdf','application/pdf',120000+v_i*913,v_user.id) on conflict do nothing;
  insert into public.task_activity(task_id,actor_id,actor_role,action,new_values) values(v_task,v_arjun,'manager','task.created',jsonb_build_object('status','not_started','assignee',v_user.id));
  if v_status<>'not_started' then insert into public.task_activity(task_id,actor_id,actor_role,action,old_values,new_values) values(v_task,v_user.id,'site_staff','task.status_updated',jsonb_build_object('status','not_started','progressPercent',0),jsonb_build_object('status',v_status,'progressPercent',case when v_status='completed' then 100 else v_i*10 end));end if;
 end loop;

 -- Project, direct, and finance conversations.
 foreach v_conv in array array['74000000-0000-4000-8000-000000000001'::uuid,'74000000-0000-4000-8000-000000000002'::uuid,'74000000-0000-4000-8000-000000000003'::uuid] loop
  insert into public.conversations(id,organization_id,type,name,description,project_id,created_by)
  values(v_conv,v_org,case when v_conv::text like '%1' then 'project'::public.conversation_type when v_conv::text like '%2' then 'direct'::public.conversation_type else 'group'::public.conversation_type end,
   case when v_conv::text like '%1' then 'CMRL UG-03 Daily Coordination' when v_conv::text like '%2' then 'Arjun and Priya - Field Coordination' else 'Claims and Payment Coordination' end,
   'Operational conversation retained as project evidence.',case when v_conv::text like '%1' then v_project end,case when v_conv::text like '%3' then v_rohit else v_arjun end)
  on conflict(id) do nothing;
 end loop;
 insert into public.conversation_members(conversation_id,user_id,member_role)
 values
 ('74000000-0000-4000-8000-000000000001',v_arjun,'owner'),('74000000-0000-4000-8000-000000000001',v_kavitha,'member'),('74000000-0000-4000-8000-000000000001',v_priya,'member'),
 ('74000000-0000-4000-8000-000000000002',v_arjun,'owner'),('74000000-0000-4000-8000-000000000002',v_priya,'member'),
 ('74000000-0000-4000-8000-000000000003',v_rohit,'owner'),('74000000-0000-4000-8000-000000000003',v_meera,'member'),('74000000-0000-4000-8000-000000000003',v_priya,'member') on conflict do nothing;
 insert into public.messages(id,conversation_id,sender_id,content,message_type,sent_at) values
 ('75000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',v_arjun,'Please confirm diaphragm wall reinforcement inspection readiness by 10:30.','text','2026-07-05 09:05+05:30'),
 ('75000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000001',v_priya,'Checklist is complete. Cover blocks at panel DW-18 were corrected and rechecked.','text','2026-07-05 09:42+05:30'),
 ('75000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000002',v_priya,'Cube-test register and pour card are ready for your review.','file','2026-07-05 11:15+05:30'),
 ('75000000-0000-4000-8000-000000000004','74000000-0000-4000-8000-000000000003',v_rohit,'Combined voucher has cleared SAP export and both payment tranches are posted.','text','2026-07-05 15:30+05:30'),
 ('75000000-0000-4000-8000-000000000005','74000000-0000-4000-8000-000000000003',v_priya,'Bank credits received. I have reconciled them against the employee ledger.','text','2026-07-05 16:10+05:30') on conflict(id) do nothing;
 update public.messages set replied_to_id='75000000-0000-4000-8000-000000000001' where id='75000000-0000-4000-8000-000000000002';
 insert into public.message_attachments(message_id,file_url,file_name,file_type,file_size,uploaded_by) values('75000000-0000-4000-8000-000000000003','message-files/2026/cube-test-register.pdf','Cube Test Register - June.pdf','application/pdf',286400,v_priya) on conflict do nothing;
 insert into public.message_read_receipts(message_id,user_id,read_at) values
 ('75000000-0000-4000-8000-000000000001',v_arjun,'2026-07-05 09:05+05:30'),('75000000-0000-4000-8000-000000000001',v_priya,'2026-07-05 09:20+05:30'),
 ('75000000-0000-4000-8000-000000000004',v_rohit,'2026-07-05 15:30+05:30'),('75000000-0000-4000-8000-000000000004',v_priya,'2026-07-05 15:50+05:30') on conflict do nothing;
 insert into public.message_reactions(message_id,user_id,reaction) values('75000000-0000-4000-8000-000000000002',v_arjun,'👍'),('75000000-0000-4000-8000-000000000004',v_priya,'✅') on conflict do nothing;

 -- Searchable cross-module document register.
 insert into public.business_documents(organization_id,module,entity_type,record_id,project_id,owner_user_id,status,document_date,data,created_by,updated_by)
 values
 (v_org,'projects','quality_plan','QAP-CMRL-UG03-REV2',v_project,v_arjun,'approved','2026-04-10',jsonb_build_object('title','Quality Assurance Plan - CMRL UG-03','revision','02','filePath','project-documents/CMRL-UG03/QAP-REV2.pdf'),v_arjun,v_arjun),
 (v_org,'safety','method_statement','MS-DW-018',v_project,v_priya,'approved','2026-06-20',jsonb_build_object('title','Diaphragm Wall Panel DW-18 Method Statement','approvedBy','Kavitha Iyer','filePath','project-documents/CMRL-UG03/MS-DW-018.pdf'),v_priya,v_kavitha),
 (v_org,'claims','sap_export','AIPL-CLAIMS-20260705',v_project,v_rohit,'exported','2026-07-05',jsonb_build_object('title','Final Claim SAP Export','voucherAmount',10550,'format','CSV'),v_rohit,v_rohit),
 (v_org,'tasks','completion_evidence','TSK-2026-0004',v_project,v_priya,'verified','2026-07-03',jsonb_build_object('title','Weekly Safety Barricade Audit Evidence','taskNumber','TSK-2026-0004'),v_priya,v_arjun)
 on conflict(organization_id,module,entity_type,record_id) do update set data=excluded.data,status=excluded.status,updated_by=excluded.updated_by;

 -- Workflow notifications for every active user, with read/unread cases.
 for v_user in select id,full_name from public.user_profiles where organization_id=v_org and status='active' and deleted_at is null loop
  insert into public.notifications(user_id,type,title,message,related_id,related_type,read_at)
  values
   (v_user.id,'task_assigned','New project task assigned','Review your task dashboard for due dates and acceptance evidence.','73000000-0000-4000-8000-000000000001','task',null),
   (v_user.id,'system_audit_complete','Module validation update','Attendance, leave, and finance workflows have passed the latest integrity checks.',null,'system',case when v_user.id in(v_meera,v_arjun) then now() end);
 end loop;
end $$;
