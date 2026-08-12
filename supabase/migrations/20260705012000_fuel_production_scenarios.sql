do $$
declare
  org_id constant uuid := '10000000-0000-4000-8000-000000000001';
  project_id constant uuid := '50000000-0000-4000-8000-000000000001';
  contract_id constant uuid := 'a26ab653-9d9a-4f33-865d-d8b28b5ad5f1';
  field_user constant uuid := '30000000-0000-4000-8000-000000000006';
  manager_user constant uuid := '30000000-0000-4000-8000-000000000003';
  machine_4821 uuid; machine_4930 uuid; machine_5074 uuid;
begin
  select id into machine_4821 from public.machine_assets where machine_number='TN-09-EX-4821';
  select id into machine_4930 from public.machine_assets where machine_number='TN-09-EX-4930';
  select id into machine_5074 from public.machine_assets where machine_number='TN-09-EX-5074';
  if machine_4821 is null or machine_4930 is null or machine_5074 is null then
    raise exception 'Machinery assets must exist before seeding fuel issues';
  end if;

  -- Remove zero-value validation placeholders without disturbing real records.
  delete from public.fuel_cash_expenses where fuel_type='active' and total_amount=0;
  delete from public.fuel_stock_ledger where fuel_type='active' and quantity_in=0 and quantity_out=0;
  delete from public.fuel_vendor_ledger where vendor_id='active' and debit=0 and credit=0;
  delete from public.fuel_vendor_deposits where vendor_id='active' and deposit_amount=1000;
  delete from public.fuel_issues where total_issued=0 and opening_stock=0 and closing_stock=0;
  delete from public.fuel_receipts where quantity=0 and total_amount=0;
  delete from public.fuel_contracts where vendor_id='active' and vendor_contract_id is null;

  delete from public.fuel_stock_ledger where reference_id in (
    '85000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001'
  );
  delete from public.fuel_vendor_ledger where reference_id in (
    '87000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001'
  );
  delete from public.fuel_vendor_deposits where id='87000000-0000-4000-8000-000000000001';
  delete from public.fuel_issues where id in (
    '86000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000002','86000000-0000-4000-8000-000000000003'
  );
  delete from public.fuel_receipts where id in (
    '85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000003'
  );

  insert into public.fuel_vendor_deposits (
    id,organization_id,project_id,vendor_id,fuel_contract_id,deposit_date,
    deposit_amount,payment_mode,payment_reference,remarks,status,created_by
  ) values (
    '87000000-0000-4000-8000-000000000001',org_id,project_id,'vendor-cauvery-fuels',
    contract_id,'2026-06-30',300000,'bank_transfer','UTR-CMRL-260630-1842',
    'Opening fuel security and revolving advance','posted',manager_user
  );

  insert into public.fuel_vendor_ledger (
    id,organization_id,project_id,vendor_id,fuel_contract_id,transaction_date,
    transaction_type,reference_id,debit,credit,balance_after,status,created_by
  ) values (
    '88000000-0000-4000-8000-000000000001',org_id,project_id,'vendor-cauvery-fuels',contract_id,
    '2026-06-30','deposit','87000000-0000-4000-8000-000000000001',0,300000,300000,'posted',manager_user
  );

  insert into public.fuel_receipts (
    id,organization_id,project_id,vendor_id,fuel_contract_id,receipt_number,
    receipt_date,fuel_type,source,quantity,unit,rate_per_unit,total_amount,
    reference_number,remarks,status,submitted_by,submitted_at,approved_by,
    approved_at,created_by
  ) values
    ('85000000-0000-4000-8000-000000000001',org_id,project_id,'vendor-cauvery-fuels',contract_id,'FRC-CMRL-2026-0701-A','2026-07-01','diesel','credit',5000,'L',94.75,473750,'CIF-INV-260701-118','Tanker seal and density verified at site','approved',field_user,'2026-07-01 11:25:00+05:30',manager_user,'2026-07-01 12:05:00+05:30',field_user),
    ('85000000-0000-4000-8000-000000000002',org_id,project_id,'vendor-cauvery-fuels',contract_id,'FRC-CMRL-2026-0703-S','2026-07-03','diesel','credit',2000,'L',94.75,189500,'CIF-INV-260703-126','Awaiting manager dip and invoice verification','submitted',field_user,'2026-07-03 16:45:00+05:30',null,null,field_user),
    ('85000000-0000-4000-8000-000000000003',org_id,project_id,'vendor-cauvery-fuels',contract_id,'FRC-CMRL-2026-0704-D','2026-07-04','diesel','cash',1000,'L',96.20,96200,'PETTY-FUEL-0704','Emergency draft purchase; invoice pending','draft',field_user,null,null,null,field_user);

  insert into public.fuel_stock_ledger (
    id,organization_id,project_id,fuel_type,transaction_date,transaction_type,
    reference_id,quantity_in,quantity_out,balance_quantity,unit_rate,status,created_by
  ) values (
    '89000000-0000-4000-8000-000000000001',org_id,project_id,'diesel','2026-07-01','receipt',
    '85000000-0000-4000-8000-000000000001',5000,0,5000,94.75,'posted',manager_user
  );
  insert into public.fuel_vendor_ledger (
    id,organization_id,project_id,vendor_id,fuel_contract_id,transaction_date,
    transaction_type,reference_id,debit,credit,balance_after,status,created_by
  ) values (
    '88000000-0000-4000-8000-000000000002',org_id,project_id,'vendor-cauvery-fuels',contract_id,
    '2026-07-01','credit_receipt','85000000-0000-4000-8000-000000000001',473750,0,-173750,'posted',manager_user
  );

  insert into public.fuel_issues (
    id,organization_id,project_id,issue_number,issue_date,fuel_type,unit,
    opening_stock,total_issued,closing_stock,remarks,status,submitted_by,
    submitted_at,approved_by,approved_at,created_by
  ) values
    ('86000000-0000-4000-8000-000000000001',org_id,project_id,'FIS-CMRL-2026-0702-A','2026-07-02','diesel','L',5000,620,4380,'Issued against signed operator slips','approved',field_user,'2026-07-02 18:15:00+05:30',manager_user,'2026-07-03 09:05:00+05:30',field_user),
    ('86000000-0000-4000-8000-000000000002',org_id,project_id,'FIS-CMRL-2026-0703-S','2026-07-03','diesel','L',4380,300,4080,'Night shift issue awaiting approval','submitted',field_user,'2026-07-03 22:10:00+05:30',null,null,field_user),
    ('86000000-0000-4000-8000-000000000003',org_id,project_id,'FIS-CMRL-2026-0704-D','2026-07-04','diesel','L',4380,100,4280,'Draft issue for generator test run','draft',field_user,null,null,null,field_user);

  insert into public.fuel_issue_rows (id,fuel_issue_id,machine_asset_id,machine_type,machine_number,quantity_issued,remarks) values
    ('8a000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001',machine_4821,'excavator','TN-09-EX-4821',250,'Day shift excavation'),
    ('8a000000-0000-4000-8000-000000000002','86000000-0000-4000-8000-000000000001',machine_4930,'excavator','TN-09-EX-4930',210,'Spoil loading'),
    ('8a000000-0000-4000-8000-000000000003','86000000-0000-4000-8000-000000000001',machine_5074,'excavator','TN-09-EX-5074',160,'Post-repair operation'),
    ('8a000000-0000-4000-8000-000000000004','86000000-0000-4000-8000-000000000002',machine_4821,'excavator','TN-09-EX-4821',180,'Night shift'),
    ('8a000000-0000-4000-8000-000000000005','86000000-0000-4000-8000-000000000002',machine_4930,'excavator','TN-09-EX-4930',120,'Night shift'),
    ('8a000000-0000-4000-8000-000000000006','86000000-0000-4000-8000-000000000003',machine_5074,'excavator','TN-09-EX-5074',100,'Generator and hydraulic test');

  insert into public.fuel_stock_ledger (
    id,organization_id,project_id,fuel_type,transaction_date,transaction_type,
    reference_id,quantity_in,quantity_out,balance_quantity,unit_rate,status,created_by
  ) values (
    '89000000-0000-4000-8000-000000000002',org_id,project_id,'diesel','2026-07-02','issue',
    '86000000-0000-4000-8000-000000000001',0,620,4380,94.75,'posted',manager_user
  );
end $$;

do $$
declare stock numeric; receipt_qty numeric; issue_qty numeric;
begin
  select coalesce(sum(quantity),0) into receipt_qty from public.fuel_receipts where status='approved' and project_id='50000000-0000-4000-8000-000000000001' and fuel_type='diesel';
  select coalesce(sum(total_issued),0) into issue_qty from public.fuel_issues where status='approved' and project_id='50000000-0000-4000-8000-000000000001' and fuel_type='diesel';
  select balance_quantity into stock from public.fuel_stock_ledger where project_id='50000000-0000-4000-8000-000000000001' and fuel_type='diesel' order by transaction_date desc,created_at desc limit 1;
  if stock is distinct from receipt_qty-issue_qty then raise exception 'Fuel stock does not reconcile: %, expected %',stock,receipt_qty-issue_qty; end if;
end $$;
