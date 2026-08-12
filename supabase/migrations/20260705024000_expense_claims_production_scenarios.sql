-- Expense claims: realistic status coverage and finance prerequisites.

alter table public.claims
  drop constraint if exists claims_period_valid,
  drop constraint if exists claims_amounts_valid;
alter table public.claims
  add constraint claims_period_valid check(period_to>=period_from),
  add constraint claims_amounts_valid check(
    total_claimed>=0 and total_verified>=0 and total_approved>=0
    and total_verified<=total_claimed and total_approved<=total_verified
  );

do $$
declare
 v_priya public.user_profiles; v_org uuid; v_project uuid; v_dept uuid;
 v_meera uuid; v_arjun uuid; v_kavitha uuid; v_ananya uuid; v_rohit uuid;
 v_customer uuid; v_cost uuid; v_cat1 text; v_cat2 text; v_claim uuid;
 v_status public.claim_status; v_i int; v_amount numeric; v_verified numeric; v_approved numeric;
begin
 select * into v_priya from public.user_profiles where email='priya.kulkarni@aureliainfra.in';
 v_org:=v_priya.organization_id; v_project:=v_priya.primary_project_id; v_dept:=v_priya.department_id;
 select id into v_meera from public.user_profiles where email='meera.nair@aureliainfra.in';
 select id into v_arjun from public.user_profiles where email='arjun.menon@aureliainfra.in';
 select id into v_kavitha from public.user_profiles where email='kavitha.iyer@aureliainfra.in';
 select id into v_ananya from public.user_profiles where email='ananya.rao@aureliainfra.in';
 select id into v_rohit from public.user_profiles where email='rohit.shah@aureliainfra.in';
 select id into v_customer from public.customers where organization_id=v_org and status='active' order by customer_code limit 1;
 select id into v_cost from public.project_cost_codes where project_id=v_project and status='active' order by code limit 1;
 select id into v_cat1 from public.expense_categories where status='active' order by id limit 1;
 select id into v_cat2 from public.expense_categories where status='active' order by id offset 1 limit 1;
 if v_priya.id is null or v_rohit is null or v_cat1 is null then raise exception 'Claim seed prerequisites missing'; end if;

 for v_i in 1..9 loop
  v_claim:=('71000000-0000-4000-8000-'||lpad(v_i::text,12,'0'))::uuid;
  v_status:=case v_i when 1 then 'draft' when 2 then 'admin_verification_pending'
    when 3 then 'manager_approval_pending' when 4 then 'final_approval_pending'
    when 5 then 'changes_requested' when 6 then 'accounts_verification_pending'
    when 7 then 'voucher_pending' when 8 then 'rejected' else 'withdrawn' end;
  v_amount:=1450+(v_i*625); v_verified:=case when v_i<=2 then 0 else v_amount-100 end;
  v_approved:=case when v_i<=3 then 0 else v_amount-175 end;
  insert into public.claims(
   id,claim_number,title,user_id,organization_id,department_id,project_id,customer_id,customer_name,work_type,
   period_from,period_to,status,total_claimed,total_verified,total_approved,remarks,submitted_at,created_by,updated_by
  ) values(
   v_claim,'EC-2026-'||lpad(v_i::text,4,'0'),
   case v_i when 1 then 'June local conveyance draft' when 2 then 'Site mobilisation travel expenses'
    when 3 then 'Concrete pour meal and transport claim' when 4 then 'Safety inspection travel reimbursement'
    when 5 then 'Vendor coordination expenses requiring clarification' when 6 then 'Commissioning travel and lodging'
    when 7 then 'Approved emergency material collection expenses' when 8 then 'Out-of-policy personal travel claim'
    else 'Withdrawn duplicate local conveyance claim' end,
   v_priya.id,v_org,v_dept,v_project,v_customer,(select customer_name from public.customers where id=v_customer),'Civil Works',
   date '2026-05-01'+(v_i*3),date '2026-05-02'+(v_i*3),v_status,v_amount,v_verified,v_approved,
   case v_status when 'changes_requested' then 'Original bill number requires correction.' when 'rejected' then 'Expense is outside the approved travel policy.' when 'withdrawn' then 'Duplicate submission withdrawn by employee.' else 'Project expense with itemised supporting records.' end,
   case when v_status='draft' then null else now()-(20-v_i)*interval '1 day' end,v_priya.id,
   case when v_status in ('draft','withdrawn') then v_priya.id when v_status='admin_verification_pending' then v_meera when v_status='manager_approval_pending' then v_arjun when v_status='final_approval_pending' then v_kavitha else v_rohit end
  ) on conflict(claim_number) do update set status=excluded.status,total_claimed=excluded.total_claimed,total_verified=excluded.total_verified,total_approved=excluded.total_approved,remarks=excluded.remarks,updated_by=excluded.updated_by;

  if not exists(select 1 from public.claim_items where claim_id=v_claim) then
   insert into public.claim_items(claim_id,category_id,project_id,project_cost_code_id,description,bill_type,amount,expense_date,attachment_link,remarks)
   values
    (v_claim,v_cat1,v_project,v_cost,'Taxi from site to client coordination meeting','with_bill',round(v_amount*.62,2),date '2026-05-01'+(v_i*3),'claim-attachments/2026/priya/'||v_claim||'-taxi.pdf','GST receipt and trip details attached.'),
    (v_claim,coalesce(v_cat2,v_cat1),v_project,v_cost,'Meals during extended site shift','without_bill',v_amount-round(v_amount*.62,2),date '2026-05-02'+(v_i*3),null,'Self-certified within policy limit.');
   insert into public.claim_attachments(claim_id,file_url,file_name,file_type,file_size,uploaded_by)
   values(v_claim,'claim-attachments/2026/priya/'||v_claim||'-taxi.pdf','Taxi Receipt '||v_i||'.pdf','application/pdf',90000+(v_i*2111),v_priya.id);
   insert into public.claim_approvals(claim_id,organization_id,department_id,stage,decision,actor_id,actor_role,actor_name,remarks,amount_before,amount_after)
   values(v_claim,v_org,v_dept,'submission','submitted',v_priya.id,'site_staff',v_priya.full_name,'Submitted with expense breakup.',v_amount,v_amount);
   if v_i>=3 then insert into public.claim_approvals(claim_id,organization_id,department_id,stage,decision,actor_id,actor_role,actor_name,remarks,amount_before,amount_after)
    values(v_claim,v_org,v_dept,'admin_verification','approved',v_meera,'admin_hr','Meera Nair','Bills and policy fields verified.',v_amount,v_verified); end if;
   if v_i>=4 and v_i not in (5,8,9) then insert into public.claim_approvals(claim_id,organization_id,department_id,stage,decision,actor_id,actor_role,actor_name,remarks,amount_before,amount_after)
    values(v_claim,v_org,v_dept,'manager_approval','approved',v_arjun,'manager','Arjun Menon','Project purpose and cost code confirmed.',v_verified,v_approved); end if;
   if v_i in (6,7) then insert into public.claim_approvals(claim_id,organization_id,department_id,stage,decision,actor_id,actor_role,actor_name,remarks,amount_before,amount_after)
    values(v_claim,v_org,v_dept,'final_approval','approved',coalesce(v_kavitha,v_ananya),'hod','Kavitha Iyer','Final business justification approved.',v_approved,v_approved); end if;
  end if;
 end loop;

 insert into public.claim_accounts_verifications(organization_id,claim_id,verified_by,verification_status,verification_date,accounts_remarks,payable_amount,deduction_amount,payment_priority,requires_sap_export,sap_export_status)
 select v_org,id,v_rohit,'verified',now(),'Verified with policy deduction retained.',total_approved,0,'urgent',true,'pending'
 from public.claims where id='71000000-0000-4000-8000-000000000007'
 on conflict(claim_id) do update set verification_status='verified',verified_by=v_rohit,payable_amount=excluded.payable_amount,payment_priority='urgent',requires_sap_export=true,sap_export_status='pending';

 -- Employee advance scenarios that feed the finance ledger.
 insert into public.employee_advances(id,organization_id,employee_id,advance_type,advance_date,amount,reference_number,remarks,created_by)
 values
 ('72000000-0000-4000-8000-000000000001',v_org,v_priya.id,'opening_balance','2026-04-01',5000,'ADV-OB-2026-001','Opening site travel advance.',v_rohit),
 ('72000000-0000-4000-8000-000000000002',v_org,v_priya.id,'rolling_advance','2026-05-15',7500,'ADV-ROLL-2026-014','Rolling advance for commissioning travel.',v_rohit),
 ('72000000-0000-4000-8000-000000000003',v_org,v_priya.id,'temporary_advance','2026-06-10',3000,'ADV-TEMP-2026-021','Temporary advance for statutory inspection visit.',v_rohit)
 on conflict(id) do nothing;
 insert into public.employee_ledger_entries(organization_id,employee_id,entry_date,entry_type,reference_type,reference_id,debit_amount,credit_amount,balance_after,remarks,created_by)
 values
 (v_org,v_priya.id,'2026-04-01','opening_balance','advance','72000000-0000-4000-8000-000000000001',0,5000,5000,'Opening advance balance.',v_rohit),
 (v_org,v_priya.id,'2026-05-15','advance_added','advance','72000000-0000-4000-8000-000000000002',0,7500,12500,'Rolling advance added.',v_rohit),
 (v_org,v_priya.id,'2026-06-10','advance_added','advance','72000000-0000-4000-8000-000000000003',0,3000,15500,'Temporary inspection advance added.',v_rohit)
 on conflict do nothing;

 insert into public.sap_gl_mappings(organization_id,expense_category_id,sap_gl_code,sap_cost_center,sap_profit_center,company_code,posting_group,active)
 select v_org,e.id,case when e.requires_bill then '510210' else '510290' end,'CC-CMRL-UG03','PC-INFRA-SOUTH','AIPL',case when e.requires_bill then 'separate' else 'other' end,true
 from public.expense_categories e where e.status='active'
 and not exists(select 1 from public.sap_gl_mappings m where m.organization_id=v_org and m.expense_category_id=e.id);
 insert into public.sap_gl_mappings(organization_id,expense_category_id,sap_gl_code,sap_cost_center,sap_profit_center,company_code,posting_group,active)
 select v_org,null,'510299','CC-CMRL-UG03','PC-INFRA-SOUTH','AIPL','other',true
 where not exists(select 1 from public.sap_gl_mappings where organization_id=v_org and expense_category_id is null and posting_group='other');
 update public.sap_export_settings set company_code='AIPL',currency='INR',employee_vendor_code_rule='employee_code',enabled=true where organization_id=v_org;

 if (select count(distinct status) from public.claims where organization_id=v_org)<9 then raise exception 'Claim scenario status coverage failed'; end if;
end $$;
