-- Production-like Casual Labour scenarios for the CMRL project.
-- Fixed identifiers keep the migration repeatable and make integrity checks deterministic.
do $$
declare
  org_id constant uuid := '10000000-0000-4000-8000-000000000001';
  project_id constant uuid := '50000000-0000-4000-8000-000000000001';
  field_user constant uuid := '30000000-0000-4000-8000-000000000006';
  manager_user constant uuid := '30000000-0000-4000-8000-000000000003';
  labour_contract_id uuid;
  payee_uuid uuid := '74000000-0000-4000-8000-000000000001';
begin
  select id into labour_contract_id
  from public.vendor_contracts
  where organization_id = org_id
    and contract_code = 'AIP-LAB-CMRL-2026-01'
    and contract_type = 'labour'
    and status = 'active';

  if labour_contract_id is null then
    raise exception 'Active labour contract AIP-LAB-CMRL-2026-01 is required';
  end if;

  insert into public.labour_payees (
    id, organization_id, project_id, contract_id, vendor_contract_id, vendor_id,
    payee_type, payee_name, phone, payment_details, status, created_by
  ) values (
    payee_uuid, org_id, project_id, labour_contract_id, labour_contract_id, 'vendor-sakthi-workforce',
    'vendor', 'Sakthi Workforce Solutions', '+91 98401 66218',
    'NEFT to verified vendor account ending 4821', 'active', manager_user
  ) on conflict (contract_id, payee_type, payee_name) do update set
    phone = excluded.phone,
    payment_details = excluded.payment_details,
    status = excluded.status,
    vendor_contract_id = excluded.vendor_contract_id;

  -- Resolve the row that owns the unique business key if it predates this seed.
  select id into payee_uuid
  from public.labour_payees
  where contract_id = labour_contract_id
    and payee_type = 'vendor'
    and payee_name = 'Sakthi Workforce Solutions'
  limit 1;

  delete from public.casual_labour_bills where attendance_id in (
    '75000000-0000-4000-8000-000000000001',
    '75000000-0000-4000-8000-000000000002',
    '75000000-0000-4000-8000-000000000003'
  );
  delete from public.casual_labour_work_allocations
  where linked_attendance_ids && array[
    '75000000-0000-4000-8000-000000000001'::uuid,
    '75000000-0000-4000-8000-000000000002'::uuid,
    '75000000-0000-4000-8000-000000000003'::uuid
  ];
  delete from public.casual_labour_attendance where id in (
    '75000000-0000-4000-8000-000000000001',
    '75000000-0000-4000-8000-000000000002',
    '75000000-0000-4000-8000-000000000003'
  );
  delete from public.labour_advance_deductions where id in (
    '76000000-0000-4000-8000-000000000001',
    '76000000-0000-4000-8000-000000000002',
    '76000000-0000-4000-8000-000000000003'
  );
  delete from public.labour_rosters where id in (
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000002',
    '73000000-0000-4000-8000-000000000003',
    '73000000-0000-4000-8000-000000000004'
  );

  insert into public.labour_rosters (
    id, organization_id, project_id, vendor_id, contract_id, vendor_contract_id,
    worker_code, worker_name, gender, category, skill_type, phone,
    id_proof_type, id_proof_number, daily_rate_override, ot_rate_override,
    default_payee_id, status, created_by
  ) values
    ('73000000-0000-4000-8000-000000000001', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, labour_contract_id,
     'CMRL-LAB-001', 'Ramesh Kumar', 'male', 'male', 'unskilled', '+91 90031 41001', 'Aadhaar', 'XXXX-XXXX-1842', 980, 180, payee_uuid, 'active', field_user),
    ('73000000-0000-4000-8000-000000000002', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, labour_contract_id,
     'CMRL-LAB-002', 'Selvi Murugan', 'female', 'female', 'skilled', '+91 90031 41002', 'Aadhaar', 'XXXX-XXXX-2751', 930, 180, payee_uuid, 'active', field_user),
    ('73000000-0000-4000-8000-000000000003', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, labour_contract_id,
     'CMRL-LAB-003', 'Mani Kannan', 'male', 'supervisor', 'supervisor', '+91 90031 41003', 'Voter ID', 'TN-XX-8842031', 1450, 250, payee_uuid, 'active', field_user),
    ('73000000-0000-4000-8000-000000000004', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, labour_contract_id,
     'CMRL-LAB-004', 'Farzana Begum', 'female', 'female', 'skilled', '+91 90031 41004', 'Aadhaar', 'XXXX-XXXX-6308', 930, 180, payee_uuid, 'inactive', field_user);

  insert into public.casual_labour_attendance (
    id, organization_id, project_id, vendor_id, contract_id, attendance_number,
    date, work_area, work_description, male_allocated, female_allocated,
    supervisor_allocated, status, submitted_by, submitted_at, approved_by,
    approved_at, created_by
  ) values
    ('75000000-0000-4000-8000-000000000001', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id,
     'LAB-CMRL-2026-0626-D', '2026-06-26', 'Casting Yard – Bay 2', 'Rebar sorting and shutter cleaning', 1, 0, 0,
     'draft', field_user, null, null, null, field_user),
    ('75000000-0000-4000-8000-000000000002', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id,
     'LAB-CMRL-2026-0627-S', '2026-06-27', 'Pier P118–P120', 'Barricading, debris removal, and access preparation', 4, 2, 1,
     'submitted', field_user, '2026-06-27 18:35:00+05:30', null, null, field_user),
    ('75000000-0000-4000-8000-000000000003', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id,
     'LAB-CMRL-2026-0628-A', '2026-06-28', 'Station Box – North Entry', 'Dewatering support and reinforcement handling', 1, 1, 1,
     'approved', field_user, '2026-06-28 18:42:00+05:30', manager_user, '2026-06-29 09:18:00+05:30', field_user);

  insert into public.casual_labour_attendance_items (
    id, organization_id, project_id, vendor_id, contract_id, attendance_id,
    roster_id, worker_code, worker_name, entry_mode, category, gender, skill_type,
    worker_count, start_time, end_time, worked_hours, normal_hours, overtime_hours,
    normal_rate, overtime_rate, allowance, deduction, normal_amount,
    overtime_amount, net_amount, payee_type, payee_id, payee_name,
    manual_override_reason, remarks, status, created_by
  ) values
    ('77000000-0000-4000-8000-000000000001', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, '75000000-0000-4000-8000-000000000001',
     '73000000-0000-4000-8000-000000000001', 'CMRL-LAB-001', 'Ramesh Kumar', 'named_worker', 'male', 'male', 'unskilled',
     1, '09:00', '17:00', 8, 8, 0, 980, 180, 0, 0, 980, 0, 980, 'vendor', payee_uuid, 'Sakthi Workforce Solutions', null, 'Draft retained for next-day correction', 'draft', field_user),
    ('77000000-0000-4000-8000-000000000002', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, '75000000-0000-4000-8000-000000000002',
     null, 'COUNT-MALE', 'General male labour', 'count_based', 'male', 'male', 'unskilled',
     4, '08:30', '17:30', 9, 8, 1, 980, 180, 50, 0, 3920, 720, 4840, 'vendor', payee_uuid, 'Sakthi Workforce Solutions', 'Count verified against gate register GR-0627', 'Four workers deployed for access preparation', 'submitted', field_user),
    ('77000000-0000-4000-8000-000000000003', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, '75000000-0000-4000-8000-000000000002',
     null, 'COUNT-FEMALE', 'General female labour', 'count_based', 'female', 'female', 'skilled',
     2, '08:30', '17:30', 9, 8, 1, 930, 180, 50, 0, 1860, 360, 2320, 'vendor', payee_uuid, 'Sakthi Workforce Solutions', 'Count verified against gate register GR-0627', 'Two skilled helpers', 'submitted', field_user),
    ('77000000-0000-4000-8000-000000000004', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, '75000000-0000-4000-8000-000000000002',
     '73000000-0000-4000-8000-000000000003', 'CMRL-LAB-003', 'Mani Kannan', 'named_worker', 'supervisor', 'male', 'supervisor',
     1, '08:30', '17:30', 9, 8, 1, 1450, 250, 100, 0, 1450, 250, 1800, 'vendor', payee_uuid, 'Sakthi Workforce Solutions', null, 'Shift supervisor', 'submitted', field_user),
    ('77000000-0000-4000-8000-000000000005', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, '75000000-0000-4000-8000-000000000003',
     '73000000-0000-4000-8000-000000000001', 'CMRL-LAB-001', 'Ramesh Kumar', 'named_worker', 'male', 'male', 'unskilled',
     1, '08:00', '18:00', 10, 8, 2, 980, 180, 100, 50, 980, 360, 1390, 'vendor', payee_uuid, 'Sakthi Workforce Solutions', null, 'Approved against gate and toolbox records', 'approved', field_user),
    ('77000000-0000-4000-8000-000000000006', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, '75000000-0000-4000-8000-000000000003',
     '73000000-0000-4000-8000-000000000002', 'CMRL-LAB-002', 'Selvi Murugan', 'named_worker', 'female', 'female', 'skilled',
     1, '08:00', '12:00', 4, 4, 0, 930, 180, 100, 0, 465, 0, 565, 'vendor', payee_uuid, 'Sakthi Workforce Solutions', 'Half-day confirmed by site engineer', 'Half day – medical appointment', 'approved', field_user),
    ('77000000-0000-4000-8000-000000000007', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, '75000000-0000-4000-8000-000000000003',
     '73000000-0000-4000-8000-000000000003', 'CMRL-LAB-003', 'Mani Kannan', 'named_worker', 'supervisor', 'male', 'supervisor',
     1, '08:00', '17:00', 9, 8, 1, 1450, 250, 150, 100, 1450, 250, 1750, 'vendor', payee_uuid, 'Sakthi Workforce Solutions', null, 'Supervisor recovery for damaged PPE', 'approved', field_user);

  insert into public.casual_labour_work_allocations (
    id, organization_id, project_id, vendor_id, contract_id, allocation_date,
    work_area, work_description, male_count, female_count, supervisor_count,
    skilled_count, unskilled_count, linked_attendance_ids, remarks, status, created_by
  ) values
    ('78000000-0000-4000-8000-000000000001', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, '2026-06-26', 'Casting Yard – Bay 2', 'Rebar sorting and shutter cleaning', 1, 0, 0, 0, 1, array['75000000-0000-4000-8000-000000000001'::uuid], 'Draft allocation', 'draft', field_user),
    ('78000000-0000-4000-8000-000000000002', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, '2026-06-27', 'Pier P118–P120', 'Barricading, debris removal, and access preparation', 4, 2, 1, 2, 4, array['75000000-0000-4000-8000-000000000002'::uuid], 'Awaiting manager approval', 'submitted', field_user),
    ('78000000-0000-4000-8000-000000000003', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, '2026-06-28', 'Station Box – North Entry', 'Dewatering support and reinforcement handling', 1, 1, 1, 1, 1, array['75000000-0000-4000-8000-000000000003'::uuid], 'Verified by Arjun Menon', 'approved', field_user);

  insert into public.labour_advance_deductions (
    id, organization_id, project_id, vendor_id, contract_id, payee_id,
    transaction_date, transaction_type, amount, reference_id, remarks, status,
    created_by, updated_by
  ) values
    ('76000000-0000-4000-8000-000000000001', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, payee_uuid, '2026-06-20', 'advance', 25000, null, 'Mobilisation advance for June workforce', 'posted', manager_user, manager_user),
    ('76000000-0000-4000-8000-000000000002', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, payee_uuid, '2026-06-28', 'deduction', 5000, '75000000-0000-4000-8000-000000000003', 'PPE and site-facility recovery', 'posted', manager_user, manager_user),
    ('76000000-0000-4000-8000-000000000003', org_id, project_id, 'vendor-sakthi-workforce', labour_contract_id, payee_uuid, '2026-06-30', 'adjustment', 1500, '75000000-0000-4000-8000-000000000003', 'Attendance reconciliation adjustment', 'posted', manager_user, manager_user);

  insert into public.casual_labour_bills (
    id, organization_id, project_id, vendor_id, contract_id, attendance_id,
    period_from, period_to, normal_amount, overtime_amount, allowance_amount,
    deduction_amount, net_amount, status, created_by
  ) values (
    '79000000-0000-4000-8000-000000000001', org_id, project_id,
    'vendor-sakthi-workforce', labour_contract_id, '75000000-0000-4000-8000-000000000003',
    '2026-06-28', '2026-06-28', 2895, 610, 350, 150, 3705, 'approved', manager_user
  );
end $$;

-- Fail deployment if the approved bill ever diverges from its canonical lines.
do $$
declare mismatch_count integer;
begin
  select count(*) into mismatch_count
  from public.casual_labour_bills bill
  join (
    select attendance_id,
      sum(normal_amount) normal_amount,
      sum(overtime_amount) overtime_amount,
      sum(allowance) allowance_amount,
      sum(deduction) deduction_amount,
      sum(net_amount) net_amount
    from public.casual_labour_attendance_items
    group by attendance_id
  ) lines on lines.attendance_id = bill.attendance_id
  where bill.id = '79000000-0000-4000-8000-000000000001'
    and (bill.normal_amount, bill.overtime_amount, bill.allowance_amount,
         bill.deduction_amount, bill.net_amount)
      is distinct from
        (lines.normal_amount, lines.overtime_amount, lines.allowance_amount,
         lines.deduction_amount, lines.net_amount);
  if mismatch_count > 0 then
    raise exception 'Casual Labour approved bill does not reconcile to attendance items';
  end if;
end $$;
