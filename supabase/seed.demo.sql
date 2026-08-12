-- Production-like, deterministic Site Connect validation seed.
-- Authentication password for every seeded account: SiteConnect@2026
-- This file is destructive only when preceded by reset/001_wipe_app_data.sql
-- and reset/003_optional_wipe_auth_users.sql.

begin;

insert into public.roles (id,name,short_name,description,rank) values
('site_staff','Site Staff / User','User','Field and office users who submit operational records.',10),
('manager','Project Manager','Manager','Project-level operational and approval authority.',30),
('hod','Department Head','HOD','Department workflow and performance owner.',35),
('admin_hr','Administration and HR','Admin','People, policy and master-data administration.',40),
('accounts_officer','Accounts Officer','Accounts','Verification, vouchers, ledgers and payments.',50),
('super_admin','Super Admin','Super Admin','Initial master administrator with complete organization oversight.',100)
on conflict (id) do update set name=excluded.name,short_name=excluded.short_name,description=excluded.description,rank=excluded.rank;

insert into public.organizations
(id,organization_code,organization_name,legal_name,gst_number,pan_number,address,city,state,pincode,support_email,support_phone)
values ('10000000-0000-4000-8000-000000000001','AIP','Aurelia Infrastructure & Projects','Aurelia Infrastructure & Projects Private Limited','33AAQCA4821M1Z7','AAQCA4821M','18 Mount Poonamallee Road, Manapakkam','Chennai','Tamil Nadu','600089','support@aureliainfra.in','+91 44 4018 2700');

insert into public.departments (id,organization_id,name,department_code,department_name,description) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Executive Management','EXEC','Executive Management','Corporate governance and final approvals'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Projects','PROJ','Projects','Project planning and delivery'),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Civil Engineering','CIV','Civil Engineering','Site execution and quality'),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Human Resources','HR','Human Resources','People operations and compliance'),
('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','Finance & Accounts','FIN','Finance & Accounts','Finance, accounts and SAP'),
('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','Procurement & Stores','PROC','Procurement & Stores','Materials, vendors and stores'),
('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','Plant & Machinery','PLANT','Plant & Machinery','Machinery and fuel operations');

insert into public.designations (id,organization_id,department_id,designation_code,designation_name,level_rank,description) values
('21000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','MASTER','Initial Master Account — Super Admin',100,'Initial master administrator with complete organization oversight.'),
('21000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','HRMGR','HR Manager',70,'HR and administration lead'),
('21000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','PM','Project Manager',60,'Project delivery lead'),
('21000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','CIVHOD','Head - Civil',65,'Civil engineering department head'),
('21000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','ACCT','Accounts Officer',40,'Accounts processing'),
('21000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','SITEENG','Site Engineer',30,'Site engineering'),
('21000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','SUPV','Site Supervisor',20,'Field supervision'),
('21000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000006','STORE','Store Officer',30,'Site stores'),
('21000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000007','PLANTENG','Plant Engineer',30,'Plant operations'),
('21000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','HREXE','HR Executive',25,'HR operations');

-- Deterministic Auth users allow repeatable relationship tests.
with seeded(id,email,full_name) as (values
('30000000-0000-4000-8000-000000000001'::uuid,'ananya.rao@aureliainfra.in','Ananya Rao'),
('30000000-0000-4000-8000-000000000002'::uuid,'meera.nair@aureliainfra.in','Meera Nair'),
('30000000-0000-4000-8000-000000000003'::uuid,'arjun.menon@aureliainfra.in','Arjun Menon'),
('30000000-0000-4000-8000-000000000004'::uuid,'kavitha.iyer@aureliainfra.in','Kavitha Iyer'),
('30000000-0000-4000-8000-000000000005'::uuid,'rohit.shah@aureliainfra.in','Rohit Shah'),
('30000000-0000-4000-8000-000000000006'::uuid,'priya.kulkarni@aureliainfra.in','Priya Kulkarni'),
('30000000-0000-4000-8000-000000000007'::uuid,'vijay.kumar@aureliainfra.in','Vijay Kumar'),
('30000000-0000-4000-8000-000000000008'::uuid,'suresh.babu@aureliainfra.in','Suresh Babu'),
('30000000-0000-4000-8000-000000000009'::uuid,'nisha.patel@aureliainfra.in','Nisha Patel'),
('30000000-0000-4000-8000-000000000010'::uuid,'deepak.singh@aureliainfra.in','Deepak Singh')
)
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new)
select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',email,
 crypt('SiteConnect@2026',gen_salt('bf')),now(),
 jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
 jsonb_build_object('full_name',full_name),now(),now(),'','','','' from seeded;

insert into auth.identities(provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
select email,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now(),now()
from auth.users where id::text like '30000000-0000-4000-8000-%';

insert into public.user_profiles
(id,organization_id,employee_id,employee_code,first_name,last_name,full_name,email,phone,role_id,department_id,designation_id,manager_id,reporting_manager_id,hod_user_id,employment_type,joining_date,status)
values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','AIP-0001','AIP-0001','Ananya','Rao','Ananya Rao','ananya.rao@aureliainfra.in','+91 98400 10001','super_admin','20000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001',null,null,null,'permanent','2018-04-02','active'),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','AIP-0012','AIP-0012','Meera','Nair','Meera Nair','meera.nair@aureliainfra.in','+91 98400 10002','admin_hr','20000000-0000-4000-8000-000000000004','21000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','permanent','2019-06-10','active'),
('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','AIP-0021','AIP-0021','Arjun','Menon','Arjun Menon','arjun.menon@aureliainfra.in','+91 98400 10003','manager','20000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','permanent','2020-01-15','active'),
('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','AIP-0018','AIP-0018','Kavitha','Iyer','Kavitha Iyer','kavitha.iyer@aureliainfra.in','+91 98400 10004','hod','20000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','permanent','2019-09-02','active'),
('30000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','AIP-0034','AIP-0034','Rohit','Shah','Rohit Shah','rohit.shah@aureliainfra.in','+91 98400 10005','accounts_officer','20000000-0000-4000-8000-000000000005','21000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','permanent','2021-02-08','active'),
('30000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','AIP-0101','AIP-0101','Priya','Kulkarni','Priya Kulkarni','priya.kulkarni@aureliainfra.in','+91 98400 10006','site_staff','20000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004','permanent','2022-07-11','active'),
('30000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','AIP-0118','AIP-0118','Vijay','Kumar','Vijay Kumar','vijay.kumar@aureliainfra.in','+91 98400 10007','site_staff','20000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000004','permanent','2023-01-09','active'),
('30000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','AIP-0126','AIP-0126','Suresh','Babu','Suresh Babu','suresh.babu@aureliainfra.in','+91 98400 10008','site_staff','20000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000004','contract','2023-08-14','active'),
('30000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','AIP-0077','AIP-0077','Nisha','Patel','Nisha Patel','nisha.patel@aureliainfra.in','+91 98400 10009','site_staff','20000000-0000-4000-8000-000000000006','21000000-0000-4000-8000-000000000008','30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','permanent','2021-11-22','active'),
('30000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','AIP-0085','AIP-0085','Deepak','Singh','Deepak Singh','deepak.singh@aureliainfra.in','+91 98400 10010','site_staff','20000000-0000-4000-8000-000000000007','21000000-0000-4000-8000-000000000009','30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','permanent','2022-03-01','active');

insert into public.customers (id,organization_id,customer_code,customer_name,contact_person,email,phone,city,state,gst_number,payment_terms) values
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','CMRL','Chennai Metro Rail Limited','R. Srinivasan','projects@chennaimetrorail.org','+91 44 2379 2000','Chennai','Tamil Nadu','33AADCC4588P1ZL','30 days'),
('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','ELCOT','Electronics Corporation of Tamil Nadu','S. Lakshmi','infra@elcot.in','+91 44 6551 2345','Chennai','Tamil Nadu','33AAACE0652N1Z4','45 days');

insert into public.projects (id,organization_id,customer_id,code,name,customer_name,location,address,city,state,pincode,latitude,longitude,geofence_radius,project_budget,start_date,end_date,primary_department_id,description) values
('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','CMRL-P2-UG03','CMRL Phase II Underground Package UG-03','Chennai Metro Rail Limited','Adyar, Chennai','LB Road, Adyar','Chennai','Tamil Nadu','600020',13.0067,80.2572,450,3850000000,'2025-01-06','2028-12-31','20000000-0000-4000-8000-000000000003','Underground stations, twin tunnels and associated civil works'),
('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','ELCOT-COE-01','ELCOT Advanced Computing Centre','Electronics Corporation of Tamil Nadu','Sholinganallur, Chennai','ELCOT SEZ, Sholinganallur','Chennai','Tamil Nadu','600119',12.9010,80.2279,350,920000000,'2025-07-01','2027-03-31','20000000-0000-4000-8000-000000000003','High-performance computing centre and utility infrastructure'),
('50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001',null,'AIP-CORP','Aurelia Corporate Operations','Aurelia Infrastructure & Projects','Chennai Head Office','Manapakkam','Chennai','Tamil Nadu','600089',13.0213,80.1764,200,0,'2025-04-01','2030-03-31','20000000-0000-4000-8000-000000000001','Common corporate cost and administration project');

update public.projects set project_manager_id='30000000-0000-4000-8000-000000000003',created_by='30000000-0000-4000-8000-000000000001',updated_by='30000000-0000-4000-8000-000000000001';
update public.user_profiles set primary_project_id=case when department_id in ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000005') then '50000000-0000-4000-8000-000000000003'::uuid else '50000000-0000-4000-8000-000000000001'::uuid end,created_by='30000000-0000-4000-8000-000000000001',updated_by='30000000-0000-4000-8000-000000000001';
update public.departments set created_by='30000000-0000-4000-8000-000000000001',updated_by='30000000-0000-4000-8000-000000000001';

insert into public.approval_delegations
(organization_id,from_user_id,delegated_to_user_id,start_date,end_date,reason,status)
values ('10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004',current_date+30,current_date+35,'Project manager planned leave coverage','active');

insert into public.user_project_assignments (organization_id,user_id,project_id,department_id,assignment_type,start_date,status,created_by,updated_by)
select '10000000-0000-4000-8000-000000000001',u.id,u.primary_project_id,u.department_id,'primary',coalesce(u.joining_date,current_date),'active','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001' from public.user_profiles u;

insert into public.department_project_assignments (organization_id,department_id,project_id,assignment_type,start_date,status,created_by,updated_by)
select '10000000-0000-4000-8000-000000000001',d.id,p.id,'support','2025-01-06','active','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'
from public.departments d cross join public.projects p;

insert into public.company_settings (company_name,support_email,support_phone,website,updated_by)
values ('Aurelia Infrastructure & Projects Private Limited','support@aureliainfra.in','+91 44 4018 2700','https://aureliainfra.in','30000000-0000-4000-8000-000000000001');

insert into public.bootstrap_state(id,status,completed_at,organization_id,admin_user_id)
values (true,'complete',now(),'10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');

insert into public.project_cost_codes (id,organization_id,project_id,code,name,description,responsible_department_id,created_by,updated_by) values
('51000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','CIV-EXC','Excavation & Earthwork','Excavation, muck disposal and shoring','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),
('51000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','CIV-RCC','Structural Concrete','Reinforcement, formwork and concrete','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),
('51000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','BLD-MEP','Building MEP Services','Electrical, HVAC, plumbing and fire systems','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');

-- Re-seed migration-provided reference masters that the clean reset removes.
insert into public.expense_categories(id,name,description,requires_bill,status) values
('travel','Travel & Conveyance','Business travel and local conveyance',true,'active'),('food','Meals & Site Refreshments','Approved meals and refreshments',true,'active'),('site-purchase','Site Purchase','Urgent low-value site purchases',true,'active'),('accommodation','Accommodation','Approved project accommodation',true,'active') on conflict(id) do nothing;
insert into public.leave_types(code,name,annual_allowance,carry_forward,requires_document,status) values
('CL','Casual Leave',12,false,false,'active'),('SL','Sick Leave',10,true,true,'active'),('EL','Earned Leave',18,true,false,'active') on conflict(code) do nothing;
insert into public.shifts(name,start_time,end_time,grace_minutes,half_day_hours,full_day_hours,status) values
('General Shift','09:00','18:00',15,4,8,'active'),('Site Day Shift','07:00','16:00',15,4,8,'active'),('Site Night Shift','19:00','04:00',15,4,8,'active') on conflict do nothing;

-- Generic finalizer: creates one constraint-valid connected row in every
-- still-empty public table. It derives FK values from seeded parents, enum
-- values from pg_enum and allowed text values from CHECK constraints.
create temporary table seed_failures(table_name text primary key,error text) on commit drop;
do $$
declare pass int; t record; c record; cols text; vals text; expr text; ref record; enum_value text; check_value text; is_empty boolean; row_total bigint;
begin
 for pass in 1..8 loop
  for t in select pt.tablename from pg_tables pt where pt.schemaname='public' order by pt.tablename loop
   execute format('select not exists(select 1 from public.%I)',t.tablename) into is_empty;
   if is_empty then
    cols:=''; vals:='';
    for c in select a.attname column_name,format_type(a.atttypid,a.atttypmod) data_type,a.atttypid,
      a.attnotnull,pg_get_expr(ad.adbin,ad.adrelid) default_expr
      from pg_attribute a join pg_class cl on cl.oid=a.attrelid join pg_namespace n on n.oid=cl.relnamespace
      left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
      where n.nspname='public' and cl.relname=t.tablename and a.attnum>0 and not a.attisdropped
      and a.attnotnull and ad.adbin is null order by a.attnum
    loop
     select rc.relname ref_table,ra.attname ref_column into ref
       from pg_constraint fk join pg_class rc on rc.oid=fk.confrelid
       join unnest(fk.conkey,fk.confkey) with ordinality k(attnum,refattnum,ord) on true
       join pg_attribute la on la.attrelid=fk.conrelid and la.attnum=k.attnum
       join pg_attribute ra on ra.attrelid=fk.confrelid and ra.attnum=k.refattnum
       where fk.contype='f' and fk.conrelid=format('public.%I',t.tablename)::regclass and la.attname=c.column_name limit 1;
     if found then expr:=format('(select %I from public.%I limit 1)',ref.ref_column,ref.ref_table);
     else
      select e.enumlabel into enum_value from pg_enum e where e.enumtypid=c.atttypid order by e.enumsortorder limit 1;
      select (regexp_match(pg_get_constraintdef(pc.oid),'''([^'']+)'''))[1] into check_value from pg_constraint pc
       where pc.contype='c' and pc.conrelid=format('public.%I',t.tablename)::regclass and pg_get_constraintdef(pc.oid) ilike '%'||c.column_name||'%' limit 1;
      if enum_value is not null then expr:=quote_literal(enum_value)||'::'||c.data_type;
      elsif c.data_type in ('uuid') then expr:='gen_random_uuid()';
      elsif c.data_type like '%timestamp%' then expr:='now()';
      elsif c.data_type='date' then expr:=case when c.column_name like '%to%' or c.column_name like '%end%' or c.column_name='due_date' then 'current_date+1' else 'current_date' end;
      elsif c.data_type like 'time%' then expr:=case when c.column_name like '%end%' then quote_literal('17:00')||'::time' else quote_literal('09:00')||'::time' end;
      elsif c.data_type like 'numeric%' or c.data_type in ('integer','bigint','smallint','double precision','real') then expr:=case when c.column_name like '%amount%' or c.column_name like '%rate%' then '1000' else '1' end;
      elsif c.data_type='boolean' then expr:='false';
      elsif c.data_type='jsonb' then expr:='''{}''::jsonb';
      elsif c.data_type like '%[]' then expr:='''{}''::'||c.data_type;
      else expr:=quote_literal(coalesce(check_value,case
       when c.column_name like '%email%' then 'operations@aureliainfra.in'
       when c.column_name like '%number%' then upper(left(t.tablename,3))||'-2026-0001'
       when c.column_name like '%code%' then upper(left(t.tablename,4))||'-001'
       when c.column_name in ('name','full_name','paid_to_name','employee_name_snapshot','vendor_name','project_name') then initcap(replace(t.tablename,'_',' '))||' Production Record'
       when c.column_name like '%description%' or c.column_name in ('reason','title','action','message','comment','work_area') then 'Production workflow validation record'
       when c.column_name like '%url%' then 'https://files.aureliainfra.in/validation/document.pdf'
       when c.column_name like '%path%' then 'validation/production-document.pdf'
       when c.column_name like '%file_name%' then 'production-document.pdf'
       when c.column_name='payload' then '{}'
       else 'active' end));
      end if;
     end if;
     cols:=cols||case when cols='' then '' else ',' end||format('%I',c.column_name);
     vals:=vals||case when vals='' then '' else ',' end||expr;
     enum_value:=null; check_value:=null;
    end loop;
    begin
     if cols='' then execute format('insert into public.%I default values',t.tablename);
     else execute format('insert into public.%I (%s) values (%s)',t.tablename,cols,vals);
     end if;
     delete from seed_failures where table_name=t.tablename;
    exception when others then
     insert into seed_failures values(t.tablename,sqlerrm) on conflict(table_name) do update set error=excluded.error;
    end;
   end if;
  end loop;
 end loop;
 for t in select pt.tablename from pg_tables pt where pt.schemaname='public' order by pt.tablename loop
  execute format('select count(*) from public.%I',t.tablename) into row_total;
  if row_total=0 then
   raise exception 'Seed incomplete: %',(
    select string_agg(sf.table_name||' => '||sf.error,E'\n' order by sf.table_name)
    from seed_failures sf
   );
  end if;
 end loop;
end $$;

commit;
