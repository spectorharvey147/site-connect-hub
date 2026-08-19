do $$
declare v_priya uuid;v_org uuid;v_project uuid;v_dept uuid;v_cost uuid;v_contract uuid;v_vendor text;v_receipt uuid;v_request uuid;v_material_receipt uuid;v_claim uuid;
begin
 select id,organization_id,primary_project_id,department_id into v_priya,v_org,v_project,v_dept from public.user_profiles where email='priya.kulkarni@aureliainfra.in';
 if v_priya is null or v_org is null then return; end if;
 select id into v_cost from public.project_cost_codes where project_id=v_project and status='active' order by code limit 1;
 select id,vendor_id into v_contract,v_vendor from public.vendor_contracts where organization_id=v_org and contract_type='fuel' and project_id=v_project order by created_at limit 1;
 select id into v_receipt from public.fuel_receipts where project_id=v_project order by receipt_date limit 1;
 select id into v_claim from public.claims where user_id=v_priya and status='paid' order by paid_at desc limit 1;
 insert into public.fuel_cash_expenses(organization_id,project_id,department_id,cost_code_id,vendor_id,contract_id,fuel_receipt_id,expense_date,fuel_type,quantity,rate_per_unit,total_amount,paid_by,payment_mode,payment_reference,claim_id,remarks,status,created_by,updated_by)
 select v_org,v_project,v_dept,v_cost,v_vendor,v_contract,v_receipt,'2026-06-18','Diesel',20,92.40,1848,v_priya,'upi','UPI-AIPL-FUEL-20260618-01',v_claim,'Emergency 20-litre purchase during vendor tanker delay; receipt reconciled to the employee claim.','approved',v_priya,v_priya
 where not exists(select 1 from public.fuel_cash_expenses where payment_reference='UPI-AIPL-FUEL-20260618-01');

 select id into v_request from public.material_requests order by request_date limit 1;
 select id into v_material_receipt from public.material_receipts order by receipt_date limit 1;
 insert into public.material_request_attachments(request_id,file_name,file_url,uploaded_by)
 select v_request,'Approved Quantity Take-off - Diaphragm Wall.pdf','material-documents/requests/'||v_request||'/approved-quantity-takeoff.pdf',v_priya
 where v_request is not null and not exists(select 1 from public.material_request_attachments where request_id=v_request and file_name='Approved Quantity Take-off - Diaphragm Wall.pdf');
 insert into public.material_receipt_attachments(receipt_id,file_name,file_url,uploaded_by)
 select v_material_receipt,'Vendor Delivery Challan and Quality Certificate.pdf','material-documents/receipts/'||v_material_receipt||'/challan-quality-certificate.pdf',v_priya
 where v_material_receipt is not null and not exists(select 1 from public.material_receipt_attachments where receipt_id=v_material_receipt and file_name='Vendor Delivery Challan and Quality Certificate.pdf');
end $$;
