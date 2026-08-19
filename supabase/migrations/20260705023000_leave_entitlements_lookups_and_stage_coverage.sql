-- Restore complete leave lookups and model earned comp-off as entitlement credits.

insert into public.leave_types(code,name,annual_allowance,carry_forward,requires_document,status)
values
 ('CL','Casual Leave',12,false,false,'active'), ('SL','Sick Leave',10,false,true,'active'),
 ('PL','Privilege Leave',18,true,false,'active'), ('EL','Earned Leave',18,true,false,'active'),
 ('ML','Maternity Leave',180,false,true,'active'), ('LWP','Leave Without Pay',365,false,false,'active'),
 ('CO','Comp Off',0,true,false,'active')
on conflict(code) do update set name=excluded.name, annual_allowance=excluded.annual_allowance,
 carry_forward=excluded.carry_forward, requires_document=excluded.requires_document, status=excluded.status;

insert into public.holidays(name,date,location,holiday_type,status)
values
 ('New Year Day','2026-01-01','Tamil Nadu','company','active'),
 ('Pongal','2026-01-15','Tamil Nadu','state','active'),
 ('Thiruvalluvar Day','2026-01-16','Tamil Nadu','state','active'),
 ('Republic Day','2026-01-26','India','national','active'),
 ('Tamil New Year','2026-04-14','Tamil Nadu','state','active'),
 ('May Day','2026-05-01','Tamil Nadu','state','active'),
 ('Independence Day','2026-08-15','India','national','active'),
 ('Vinayaka Chaturthi','2026-09-14','Tamil Nadu','state','active'),
 ('Gandhi Jayanti','2026-10-02','India','national','active'),
 ('Ayudha Pooja','2026-10-20','Tamil Nadu','state','active'),
 ('Deepavali','2026-11-08','Tamil Nadu','state','active'),
 ('Christmas','2026-12-25','India','company','active')
on conflict(date,location,name) do update set holiday_type=excluded.holiday_type,status=excluded.status;

create table if not exists public.leave_balance_transactions(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references public.user_profiles(id) on delete cascade,
 leave_type_id uuid not null references public.leave_types(id),
 transaction_date date not null,
 transaction_type text not null check(transaction_type in ('credit','adjustment')),
 days numeric(6,2) not null check(days <> 0),
 source_type text not null,
 source_id uuid,
 description text not null,
 created_by uuid references public.user_profiles(id),
 created_at timestamptz not null default now()
);
create unique index if not exists uq_leave_balance_source
 on public.leave_balance_transactions(user_id,leave_type_id,source_type,source_id)
 where source_id is not null;
create index if not exists idx_leave_balance_user_type
 on public.leave_balance_transactions(user_id,leave_type_id,transaction_date);
alter table public.leave_balance_transactions enable row level security;
create policy "leave balance visible by hierarchy"
on public.leave_balance_transactions for select to authenticated using(
 user_id=auth.uid() or public.current_user_role() in ('admin_hr','super_admin')
 or exists(select 1 from public.user_profiles p where p.id=user_id and
   (p.reporting_manager_id=auth.uid() or p.manager_id=auth.uid() or p.hod_user_id=auth.uid()))
);

insert into public.leave_balance_transactions(
 organization_id,user_id,leave_type_id,transaction_date,transaction_type,days,
 source_type,source_id,description,created_by
)
select a.organization_id,a.user_id,lt.id,a.date,'credit',1,'attendance',a.id,
 'Comp-off earned for approved weekly-off attendance.',a.approved_by
from public.attendance a cross join lateral(select id from public.leave_types where code='CO') lt
where a.status in ('holiday_present','week_off_present') and a.deleted_at is null
on conflict do nothing;

do $$
declare
 v_priya public.user_profiles; v_arjun uuid; v_kavitha uuid; v_cl uuid; v_sl uuid;
 v_short uuid:=gen_random_uuid(); v_long uuid:=gen_random_uuid(); v_sick uuid:=gen_random_uuid();
 v_path_short jsonb; v_path_long jsonb;
begin
 select * into v_priya from public.user_profiles where email='priya.kulkarni@aureliainfra.in';
 select id into v_arjun from public.user_profiles where email='arjun.menon@aureliainfra.in';
 select id into v_kavitha from public.user_profiles where email='kavitha.iyer@aureliainfra.in';
 select id into v_cl from public.leave_types where code='CL'; select id into v_sl from public.leave_types where code='SL';
 if v_priya.id is null or v_arjun is null or v_kavitha is null then return; end if;
 v_path_short:=jsonb_build_array(jsonb_build_object('id','manager-priya','sequence',1,'role','manager','label','Reporting Manager','userId',v_arjun,'userName','Arjun Menon','source','default'));
 v_path_long:=v_path_short||jsonb_build_array(jsonb_build_object('id','hod-priya','sequence',2,'role','hod','label','Department HOD','userId',v_kavitha,'userName','Kavitha Iyer','source','default'));

 insert into public.leave_applications(id,leave_number,user_id,organization_id,department_id,requester_user_id,manager_id,reporting_manager_id,hod_user_id,leave_type_id,from_date,to_date,number_of_days,reason,status,approval_path,created_by,updated_by)
 values(v_short,'LV-2026-PR-01',v_priya.id,v_priya.organization_id,v_priya.department_id,v_priya.id,v_arjun,v_arjun,v_kavitha,v_cl,'2026-09-21','2026-09-22',2,'Attend a close family engagement after completing concrete pour handover.','pending',v_path_short,v_priya.id,v_priya.id)
 on conflict(leave_number) do nothing;
 insert into public.leave_approval_history(leave_id,actor_id,actor_role,decision,comments)
 values(v_short,v_priya.id,'site_staff','submitted','Handover assigned to the night-shift engineer.') on conflict do nothing;

 insert into public.leave_applications(id,leave_number,user_id,organization_id,department_id,requester_user_id,manager_id,reporting_manager_id,hod_user_id,leave_type_id,from_date,to_date,number_of_days,reason,status,approval_path,created_by,updated_by)
 values(v_long,'LV-2026-PR-02',v_priya.id,v_priya.organization_id,v_priya.department_id,v_priya.id,v_arjun,v_arjun,v_kavitha,v_cl,'2026-10-12','2026-10-16',5,'Planned hometown travel with a documented five-day work handover.','pending',v_path_long,v_priya.id,v_arjun)
 on conflict(leave_number) do nothing;
 insert into public.leave_approval_history(leave_id,actor_id,actor_role,decision,comments,approval_sequence,resulting_status)
 values(v_long,v_arjun,'manager','approved','Site coverage and pending inspections reassigned.',1,'pending') on conflict do nothing;

 insert into public.leave_applications(id,leave_number,user_id,organization_id,department_id,requester_user_id,manager_id,reporting_manager_id,hod_user_id,leave_type_id,from_date,to_date,number_of_days,reason,status,approval_path,approved_by,approval_date,comments,created_by,updated_by)
 values(v_sick,'LV-2026-PR-03',v_priya.id,v_priya.organization_id,v_priya.department_id,v_priya.id,v_arjun,v_arjun,v_kavitha,v_sl,'2026-07-13','2026-07-14',2,'Medical rest prescribed for acute viral fever.','approved',v_path_short,v_arjun,'2026-07-12 18:30+05:30','Medical certificate reviewed.',v_priya.id,v_arjun)
 on conflict(leave_number) do nothing;
 insert into public.leave_attachments(leave_id,file_url,file_name,file_type,file_size,uploaded_by)
 values(v_sick,'leave-documents/2026/priya-kulkarni/LV-2026-PR-03-medical-certificate.pdf','Medical Certificate - Priya Kulkarni.pdf','application/pdf',184320,v_priya.id)
 on conflict do nothing;
end $$;
