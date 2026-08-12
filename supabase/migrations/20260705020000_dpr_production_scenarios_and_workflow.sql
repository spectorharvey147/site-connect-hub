create unique index if not exists idx_dpr_reports_daily_header on public.dpr_reports(daily_progress_report_id) where daily_progress_report_id is not null;

create or replace function public.guard_dpr_transition()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor_role text;
begin
 if auth.uid() is null then return new; end if; actor_role:=public.current_user_role();
 if old.status in ('reviewed','returned') and new.status is distinct from old.status then raise exception 'Reviewed or returned DPRs cannot be reopened directly'; end if;
 if new.status in ('reviewed','returned') and old.status<>'submitted' then raise exception 'Only submitted DPRs can be reviewed or returned'; end if;
 if new.status in ('reviewed','returned') and actor_role not in ('manager','hod','admin_hr','super_admin') then raise exception 'Only an authorised reviewer can review DPRs'; end if;
 if new.reviewed_by is distinct from old.reviewed_by and new.reviewed_by is distinct from auth.uid() then raise exception 'reviewed_by must match the authenticated reviewer'; end if;
 return new;
end;$$;
drop trigger if exists guard_dpr_transition on public.daily_progress_reports;
create trigger guard_dpr_transition before update on public.daily_progress_reports for each row execute function public.guard_dpr_transition();

create or replace function public.review_daily_progress_report(target_dpr_id uuid,decision text,comments text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare dpr public.daily_progress_reports%rowtype; declare actor_id uuid:=auth.uid(); declare actor_role text:=public.current_user_role();
begin
 if decision not in ('reviewed','returned') then raise exception 'Invalid DPR review decision'; end if;
 if actor_id is null or actor_role not in ('manager','hod','admin_hr','super_admin') then raise exception 'Only an authorised reviewer can review DPRs'; end if;
 select * into dpr from public.daily_progress_reports where id=target_dpr_id for update;
 if not found then raise exception 'DPR not found'; end if;
 if dpr.status<>'submitted' then raise exception 'Only submitted DPRs can be reviewed or returned'; end if;
 if decision='returned' and length(trim(coalesce(comments,'')))<10 then raise exception 'Return comments must explain the required correction'; end if;
 update public.daily_progress_reports set status=decision::public.dpr_status,reviewed_by=actor_id,reviewed_at=now(),review_comments=comments where id=dpr.id;
 update public.dpr_reports set status=decision,updated_by=actor_id,updated_at=now() where daily_progress_report_id=dpr.id;
 return dpr.id;
end;$$;
revoke all on function public.review_daily_progress_report(uuid,text,text) from public; grant execute on function public.review_daily_progress_report(uuid,text,text) to authenticated;

do $$
declare org_id constant uuid:='10000000-0000-4000-8000-000000000001'; declare project_id constant uuid:='50000000-0000-4000-8000-000000000001'; declare field_user constant uuid:='30000000-0000-4000-8000-000000000006'; declare manager_user constant uuid:='30000000-0000-4000-8000-000000000003';
begin
 delete from public.daily_progress_reports where id='8e34788d-3bfc-4be4-8819-5c20ee27423f';
 delete from public.dpr_reports where daily_progress_report_id is null and report_number='DPR-2026-0001';
 delete from public.daily_progress_reports where id in('95000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000004');
 insert into public.daily_progress_reports(id,organization_id,project_id,dpr_number,report_date,shift_id,shift_name,submitted_by,weather,next_day_plan,planned_manpower,planned_equipment,status,submitted_at,reviewed_by,reviewed_at,review_comments,created_by) values
 ('95000000-0000-4000-8000-000000000001',org_id,project_id,'DPR-CMRL-2026-0630-D','2026-06-30','general','General Shift',field_user,array['cloudy'],'Complete reinforcement checks and mobilise concrete pump',28,'1 excavator, 1 concrete pump','draft',null,null,null,null,field_user),
 ('95000000-0000-4000-8000-000000000002',org_id,project_id,'DPR-CMRL-2026-0701-S','2026-07-01','day','Day Shift',field_user,array['clear','hot'],'Continue diaphragm wall excavation and shift spoil to disposal yard',34,'2 excavators, 3 dumpers','submitted','2026-07-01 19:00+05:30',null,null,null,field_user),
 ('95000000-0000-4000-8000-000000000003',org_id,project_id,'DPR-CMRL-2026-0702-RV','2026-07-02','day','Day Shift',field_user,array['cloudy'],'Commence raft starter reinforcement and dewatering checks',41,'3 excavators, 1 crane, 2 dewatering pumps','reviewed','2026-07-02 19:10+05:30',manager_user,'2026-07-03 09:00+05:30','Progress, resource deployment, and issue records verified.',field_user),
 ('95000000-0000-4000-8000-000000000004',org_id,project_id,'DPR-CMRL-2026-0703-RT','2026-07-03','night','Night Shift',field_user,array['rainy'],'Reinspect barricading and resubmit corrected concrete quantity',26,'2 excavators, lighting tower','returned','2026-07-03 23:00+05:30',manager_user,'2026-07-04 08:45+05:30','Concrete quantity does not match the pour card; attach corrected measurement and safety photograph.',field_user);
 insert into public.dpr_activities(id,dpr_id,activity_name,description,completion_percent,machines_used,custom_machines,male_labor,female_labor,supervisors,company_staff,comments) values
 ('95100000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','reinforcement','Raft reinforcement preparation and bar sorting',35,array['crane'],'[]'::jsonb,12,3,1,4,'Draft quantities'),
 ('95100000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002','excavation','Diaphragm wall excavation at North Entry',62,array['excavator','dumper'],'["TN-09-EX-4821","TN-09-EX-4930"]'::jsonb,18,4,2,5,'1,260 cubic metres excavated'),
 ('95100000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000003','dewatering','Station box dewatering and sump cleaning',80,array['pump','excavator'],'["TN-09-EX-5074"]'::jsonb,16,5,2,6,'Water level maintained below formation'),
 ('95100000-0000-4000-8000-000000000004','95000000-0000-4000-8000-000000000003','reinforcement','Raft starter reinforcement fixing',48,array['crane'],'[]'::jsonb,20,3,2,7,'2.5 MT reinforcement fixed'),
 ('95100000-0000-4000-8000-000000000005','95000000-0000-4000-8000-000000000004','concreting','Blinding concrete during night shift',40,array['concrete_mixer','pump'],'["Lighting Tower LT-04"]'::jsonb,14,2,1,5,'Quantity requires correction against pour card');
 insert into public.dpr_issues(id,dpr_id,issue_type,severity,description,resolution_notes,status) values
 ('95200000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002','equipment_breakdown','medium','Excavator EX-5074 hydraulic hose failure','Machine isolated; replacement hose arranged','resolved'),
 ('95200000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000003','material_shortage','low','Balance raft steel delivery delayed by traffic',null,'pending'),
 ('95200000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000004','quality','high','Reported concrete quantity differs from signed pour card',null,'pending');
 insert into public.dpr_photos(id,dpr_id,file_url,file_name,file_type,file_size,caption,uploaded_by) values
 ('95300000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002','https://xwyyijmhtwflujthpcbv.supabase.co/storage/v1/object/public/dpr-photos/cmrl/2026-07-01/excavation-north.jpg','excavation-north.jpg','image/jpeg',284512,'North Entry excavation progress',field_user),
 ('95300000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000003','https://xwyyijmhtwflujthpcbv.supabase.co/storage/v1/object/public/dpr-photos/cmrl/2026-07-02/dewatering-sump.jpg','dewatering-sump.jpg','image/jpeg',301224,'Dewatering sump and discharge line',field_user),
 ('95300000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000003','https://xwyyijmhtwflujthpcbv.supabase.co/storage/v1/object/public/dpr-photos/cmrl/2026-07-02/raft-steel.jpg','raft-steel.jpg','image/jpeg',326118,'Raft starter reinforcement',field_user),
 ('95300000-0000-4000-8000-000000000004','95000000-0000-4000-8000-000000000004','https://xwyyijmhtwflujthpcbv.supabase.co/storage/v1/object/public/dpr-photos/cmrl/2026-07-03/night-concrete.jpg','night-concrete.jpg','image/jpeg',265410,'Night shift blinding concrete',field_user);
 insert into public.dpr_reports(id,organization_id,project_id,daily_progress_report_id,report_number,report_date,weather,labour_count,machinery_used,material_usage,fuel_usage,completion_percentage,issues,next_day_plan,remarks,status,created_by) values
 ('95400000-0000-4000-8000-000000000001',org_id,project_id,'95000000-0000-4000-8000-000000000001','DPR-CMRL-2026-0630-D','2026-06-30','["cloudy"]'::jsonb,20,'["crane"]'::jsonb,'[{"material":"TMT steel","quantity":1.2,"unit":"MT"}]'::jsonb,'[]'::jsonb,35,null,'Complete reinforcement checks and mobilise concrete pump',null,'draft',field_user),
 ('95400000-0000-4000-8000-000000000002',org_id,project_id,'95000000-0000-4000-8000-000000000002','DPR-CMRL-2026-0701-S','2026-07-01','["clear","hot"]'::jsonb,29,'["excavator","dumper"]'::jsonb,'[]'::jsonb,'[{"fuel":"diesel","quantity":250,"unit":"L"}]'::jsonb,62,'Excavator breakdown resolved','Continue diaphragm wall excavation and shift spoil to disposal yard',null,'submitted',field_user),
 ('95400000-0000-4000-8000-000000000003',org_id,project_id,'95000000-0000-4000-8000-000000000003','DPR-CMRL-2026-0702-RV','2026-07-02','["cloudy"]'::jsonb,61,'["pump","excavator","crane"]'::jsonb,'[{"material":"TMT Fe550D","quantity":2.5,"unit":"MT"},{"material":"OPC 53 Cement","quantity":300,"unit":"Bag"}]'::jsonb,'[{"fuel":"diesel","quantity":620,"unit":"L"}]'::jsonb,64,'Steel delivery pending','Commence raft starter reinforcement and dewatering checks','Reviewed against machinery, fuel, and material records','reviewed',field_user),
 ('95400000-0000-4000-8000-000000000004',org_id,project_id,'95000000-0000-4000-8000-000000000004','DPR-CMRL-2026-0703-RT','2026-07-03','["rainy"]'::jsonb,22,'["concrete_mixer","pump"]'::jsonb,'[{"material":"OPC 53 Cement","quantity":180,"unit":"Bag"}]'::jsonb,'[{"fuel":"diesel","quantity":300,"unit":"L"}]'::jsonb,40,'Concrete quantity mismatch','Reinspect barricading and resubmit corrected concrete quantity','Returned for correction','returned',field_user);
end $$;
notify pgrst,'reload schema';
