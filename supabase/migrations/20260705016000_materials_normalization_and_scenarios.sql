alter table public.material_receipts drop constraint if exists material_receipts_vendor_id_fkey;
alter table public.material_receipts
  add constraint material_receipts_vendor_id_fkey foreign key(vendor_id) references public.vendors(id),
  add column if not exists vendor_contract_id uuid references public.vendor_contracts(id);

insert into public.materials(id,name,uom,category,status) values
 ('mat-opc53','OPC 53 Grade Cement','Bag','Cement','active'),
 ('mat-tmt-fe550','TMT Reinforcement Steel Fe550D','MT','Steel','active'),
 ('mat-m20-aggregate','20 mm Graded Aggregate','MT','Aggregate','active'),
 ('mat-msand','Manufactured Sand','MT','Sand','active'),
 ('mat-admixture-pce','PCE Concrete Admixture','L','Construction Chemical','active')
on conflict(id) do update set name=excluded.name,uom=excluded.uom,category=excluded.category,status='active';

do $$
declare org_id constant uuid:='10000000-0000-4000-8000-000000000001';
declare project_id constant uuid:='50000000-0000-4000-8000-000000000001';
declare field_user constant uuid:='30000000-0000-4000-8000-000000000006';
declare manager_user constant uuid:='30000000-0000-4000-8000-000000000003';
declare contract_id constant uuid:='3fa0215e-2240-43dc-8f64-467f5df917fd';
begin
 if not exists(select 1 from public.organizations where id=org_id)
    or not exists(select 1 from public.user_profiles where id=field_user) then
  return;
 end if;
 delete from public.material_consumption where material_id='active';
 delete from public.material_damage_wastage where material_id='active';
 delete from public.material_stock_ledger where material_id='active';
 delete from public.material_receipts where vendor_id='active';
 delete from public.material_requests where id in(select request_id from public.material_request_items where material_id='active');
 delete from public.materials where id='active';

 delete from public.material_stock_ledger where reference_id in(
  '91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001');
 delete from public.material_consumption where id in('92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002');
 delete from public.material_damage_wastage where id='93000000-0000-4000-8000-000000000001';
 delete from public.material_receipts where id in('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000003');
 delete from public.material_requests where id in('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003');

 insert into public.material_requests(id,organization_id,project_id,request_number,request_date,required_date,priority,status,requested_by,submitted_at,approved_by,approved_at,created_by) values
 ('90000000-0000-4000-8000-000000000001',org_id,project_id,'MR-CMRL-2026-0701-A','2026-07-01','2026-07-03','urgent','approved',field_user,'2026-07-01 10:00+05:30',manager_user,'2026-07-01 14:00+05:30',field_user),
 ('90000000-0000-4000-8000-000000000002',org_id,project_id,'MR-CMRL-2026-0703-S','2026-07-03','2026-07-08','high','submitted',field_user,'2026-07-03 16:00+05:30',null,null,field_user),
 ('90000000-0000-4000-8000-000000000003',org_id,project_id,'MR-CMRL-2026-0704-D','2026-07-04','2026-07-12','medium','draft',field_user,null,null,null,field_user);
 insert into public.material_request_items(id,request_id,material_id,quantity,uom,specification,estimated_cost,remarks) values
 ('90100000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','mat-opc53',2000,'Bag','IS 12269, fresh batch under 30 days',860000,'Station box raft'),
 ('90100000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001','mat-tmt-fe550',20,'MT','Fe550D, 12/16/20/25 mm with MTC',1180000,'Raft reinforcement'),
 ('90100000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','mat-m20-aggregate',180,'MT','20 mm graded, impact value within specification',216000,'Pier concrete'),
 ('90100000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000003','mat-admixture-pce',1200,'L','PCE based, slump retention 120 minutes',168000,'Trial mix and production');

 insert into public.material_receipts(id,organization_id,project_id,vendor_id,vendor_contract_id,receipt_number,linked_request_id,receipt_date,invoice_number,invoice_date,delivery_challan_number,materials_checked,quantities_match_invoice,quality_acceptable,invoice_matched,inspector_name,signature_name,status,received_by,received_at,verified_by,verified_at,created_by) values
 ('91000000-0000-4000-8000-000000000001',org_id,project_id,'vendor-southern-cement',contract_id,'MRC-CMRL-2026-0703-V','90000000-0000-4000-8000-000000000001','2026-07-03','SCST/2026/184','2026-07-03','DC-184-03',true,true,true,true,'Priya Kulkarni','Priya Kulkarni','verified',field_user,'2026-07-03 12:10+05:30',manager_user,'2026-07-03 15:30+05:30',field_user),
 ('91000000-0000-4000-8000-000000000002',org_id,project_id,'vendor-southern-cement',contract_id,'MRC-CMRL-2026-0704-R','90000000-0000-4000-8000-000000000002','2026-07-04','SCST/2026/191','2026-07-04','DC-191-04',true,true,true,false,'Priya Kulkarni','Priya Kulkarni','received',field_user,'2026-07-04 11:00+05:30',null,null,field_user),
 ('91000000-0000-4000-8000-000000000003',org_id,project_id,'vendor-southern-cement',contract_id,'MRC-CMRL-2026-0705-D',null,'2026-07-05',null,null,'DC-PENDING',false,false,false,false,null,null,'draft',field_user,null,null,null,field_user);
 insert into public.material_receipt_items(id,receipt_id,material_id,qty_ordered,qty_received,uom,condition,rate_per_unit,amount,remarks) values
 ('91100000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','mat-opc53',2000,1500,'Bag','good',430,645000,'Batch certificates verified'),
 ('91100000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','mat-tmt-fe550',20,12,'MT','good',59000,708000,'MTC and diameter checks accepted'),
 ('91100000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002','mat-m20-aggregate',180,90,'MT','good',1200,108000,'Invoice match pending'),
 ('91100000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000003','mat-msand',100,0,'MT','good',0,0,'Draft gate entry');

 insert into public.material_stock_ledger(id,organization_id,project_id,material_id,transaction_date,transaction_type,reference_id,quantity_in,quantity_out,balance_quantity,status,created_by) values
 ('94000000-0000-4000-8000-000000000001',org_id,project_id,'mat-opc53','2026-07-03','receipt','91000000-0000-4000-8000-000000000001',1500,0,1500,'posted',manager_user),
 ('94000000-0000-4000-8000-000000000002',org_id,project_id,'mat-tmt-fe550','2026-07-03','receipt','91000000-0000-4000-8000-000000000001',12,0,12,'posted',manager_user);
 insert into public.material_consumption(id,organization_id,project_id,material_id,consumption_date,quantity,work_area,purpose,remarks,status,created_by) values
 ('92000000-0000-4000-8000-000000000001',org_id,project_id,'mat-opc53','2026-07-04',300,'Station Box North','M40 raft concrete','Issued against pour card PC-0704-01','posted',field_user),
 ('92000000-0000-4000-8000-000000000002',org_id,project_id,'mat-tmt-fe550','2026-07-04',2.5,'Station Box North','Raft reinforcement','Issued against bar bending schedule BBS-RF-08','posted',field_user);
 insert into public.material_stock_ledger(id,organization_id,project_id,material_id,transaction_date,transaction_type,reference_id,quantity_in,quantity_out,balance_quantity,status,created_by) values
 ('94000000-0000-4000-8000-000000000003',org_id,project_id,'mat-opc53','2026-07-04','consumption','92000000-0000-4000-8000-000000000001',0,300,1200,'posted',field_user),
 ('94000000-0000-4000-8000-000000000004',org_id,project_id,'mat-tmt-fe550','2026-07-04','consumption','92000000-0000-4000-8000-000000000002',0,2.5,9.5,'posted',field_user);
 insert into public.material_damage_wastage(id,organization_id,project_id,material_id,transaction_date,transaction_type,quantity,reason,remarks,status,created_by) values
 ('93000000-0000-4000-8000-000000000001',org_id,project_id,'mat-opc53','2026-07-04','damage',15,'Rain-damaged bags','Segregated and recorded during monsoon inspection','posted',field_user);
 insert into public.material_stock_ledger(id,organization_id,project_id,material_id,transaction_date,transaction_type,reference_id,quantity_in,quantity_out,balance_quantity,status,created_by) values
 ('94000000-0000-4000-8000-000000000005',org_id,project_id,'mat-opc53','2026-07-04','wastage','93000000-0000-4000-8000-000000000001',0,15,1185,'posted',field_user);
end $$;

do $$ declare cement numeric; steel numeric; begin
 select balance_quantity into cement from public.material_stock_ledger where material_id='mat-opc53' order by transaction_date desc,created_at desc,id desc limit 1;
 select balance_quantity into steel from public.material_stock_ledger where material_id='mat-tmt-fe550' order by transaction_date desc,created_at desc,id desc limit 1;
 if cement<>1185 or steel<>9.5 then raise exception 'Material stock reconciliation failed'; end if;
end $$;

notify pgrst,'reload schema';
