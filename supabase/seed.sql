insert into public.organizations (
  id,
  organization_code,
  organization_name,
  legal_name,
  gst_number,
  pan_number,
  address,
  city,
  state,
  country,
  pincode,
  support_email,
  support_phone,
  currency,
  timezone,
  status
)
values (
  '00000000-0000-4000-8000-000000000101',
  'DEMO-CON',
  'Demo Construction Pvt Ltd',
  'Demo Construction Private Limited',
  '29AABCI1234F1Z5',
  'AABCI1234F',
  'Construction House, Perundurai Road',
  'Erode',
  'Tamil Nadu',
  'India',
  '560001',
  'support@democonstruction.local',
  '+91 98765 00000',
  'INR',
  'Asia/Kolkata',
  'active'
)
on conflict (id) do update set
  organization_code = excluded.organization_code,
  organization_name = excluded.organization_name,
  legal_name = excluded.legal_name,
  support_email = excluded.support_email,
  support_phone = excluded.support_phone,
  updated_at = now();

insert into public.company_settings (
  id,
  company_name,
  support_email,
  support_phone,
  currency,
  timezone
)
values (
  '00000000-0000-4000-8000-000000000100',
  'Demo Construction Pvt Ltd',
  'support@democonstruction.local',
  '+91 98765 00000',
  'INR',
  'Asia/Kolkata'
)
on conflict (id) do update set
  company_name = excluded.company_name,
  support_email = excluded.support_email,
  support_phone = excluded.support_phone,
  currency = excluded.currency,
  timezone = excluded.timezone;

insert into public.departments (
  id,
  organization_id,
  parent_department_id,
  name,
  department_code,
  department_name,
  description,
  status
)
values
  (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000101',
    null,
    'Operations',
    'OPS',
    'Operations',
    'Project execution, DPR, field work and site teams.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000206',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000201',
    'Civil',
    'CIV',
    'Civil',
    'Civil works under Operations.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000205',
    '00000000-0000-4000-8000-000000000101',
    null,
    'Finance',
    'FIN',
    'Finance',
    'Finance head, vouchers, ledgers and approvals.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000205',
    'Accounts',
    'ACC',
    'Accounts',
    'Payment processing, vouchers and ledgers.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000101',
    null,
    'HR & Administration',
    'HR',
    'HR & Administration',
    'Users, HR records, attendance corrections and master data.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000207',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000201',
    'Electrical',
    'ELEC',
    'Electrical',
    'Electrical installation, testing and commissioning.',
    'active'
  )
on conflict (organization_id, department_code) do update set
  parent_department_id = excluded.parent_department_id,
  name = excluded.name,
  department_name = excluded.department_name,
  description = excluded.description,
  status = excluded.status;

insert into public.designations (
  id,
  organization_id,
  department_id,
  designation_code,
  designation_name,
  level_rank,
  description,
  status
)
values
  (
    '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000205',
    'FIN-HEAD',
    'Finance Head / System Owner',
    100,
    'System owner with emergency override rights.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000406',
    '00000000-0000-4000-8000-000000000101',
    null,
    'HOD',
    'Department HOD',
    80,
    'Department-level workflow approver.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000403',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000201',
    'PM',
    'Project Manager',
    60,
    'Direct reporting manager for site teams.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000405',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000201',
    'SE',
    'Site Engineer',
    30,
    'Site user submitting attendance, claims, DPR and requests.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000402',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000203',
    'ADM-EXE',
    'Admin Executive',
    50,
    'Admin and HR verification role.',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000404',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000204',
    'ACC-OFF',
    'Accounts Officer',
    50,
    'Payment and ledger processing role.',
    'active'
  )
on conflict (organization_id, designation_code) do update set
  department_id = excluded.department_id,
  designation_name = excluded.designation_name,
  level_rank = excluded.level_rank,
  description = excluded.description,
  status = excluded.status;

insert into public.customers (
  id,
  organization_id,
  customer_code,
  customer_name,
  contact_person,
  email,
  phone,
  city,
  state,
  payment_terms,
  status
)
values
  (
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000101',
    'ERODE-CLIENT',
    'Erode Infrastructure Authority',
    'Project Director',
    'erode.client@example.com',
    '+91 90000 10001',
    'Erode',
    'Tamil Nadu',
    '30 days',
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000702',
    '00000000-0000-4000-8000-000000000101',
    'SALEM-CLIENT',
    'Salem Urban Development',
    'Project Director',
    'salem.client@example.com',
    '+91 90000 10002',
    'Salem',
    'Tamil Nadu',
    '30 days',
    'active'
  )
on conflict (organization_id, customer_code) do update set
  customer_name = excluded.customer_name,
  contact_person = excluded.contact_person,
  email = excluded.email,
  phone = excluded.phone,
  city = excluded.city,
  state = excluded.state,
  payment_terms = excluded.payment_terms,
  status = excluded.status;

insert into public.projects (
  id,
  organization_id,
  code,
  name,
  customer_id,
  customer_name,
  location,
  city,
  state,
  latitude,
  longitude,
  geofence_radius,
  project_budget,
  primary_department_id,
  description,
  status,
  start_date
)
values
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000101',
    'ERODE-SITE',
    'Erode Site',
    '00000000-0000-4000-8000-000000000701',
    'Erode Infrastructure Authority',
    'Erode, Tamil Nadu',
    'Erode',
    'Tamil Nadu',
    11.3410,
    77.7172,
    250,
    50000000,
    '00000000-0000-4000-8000-000000000206',
    'Primary construction site at Erode.',
    'active',
    '2026-04-01'
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000101',
    'SALEM-SITE',
    'Salem Site',
    '00000000-0000-4000-8000-000000000702',
    'Salem Urban Development',
    'Salem, Tamil Nadu',
    'Salem',
    'Tamil Nadu',
    11.6643,
    78.1460,
    250,
    45000000,
    '00000000-0000-4000-8000-000000000206',
    'Primary construction site at Salem.',
    'active',
    '2026-05-15'
  )
on conflict (code) do update set
  name = excluded.name,
  customer_name = excluded.customer_name,
  location = excluded.location,
  status = excluded.status;

insert into public.project_cost_codes (
  organization_id,
  project_id,
  code,
  name,
  expense_type,
  description,
  budget_allocated,
  responsible_department_id,
  status
)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000301', 'LAB-001', 'Labour', 'Labour', 'Erode labour cost', 12000000, '00000000-0000-4000-8000-000000000206', 'active'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000301', 'MACH-001', 'Machinery', 'Machinery', 'Erode machinery cost', 8000000, '00000000-0000-4000-8000-000000000201', 'active'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000301', 'FUEL-001', 'Fuel', 'Fuel', 'Erode fuel cost', 4000000, '00000000-0000-4000-8000-000000000201', 'active'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000301', 'MAT-001', 'Material', 'Material', 'Erode material cost', 18000000, '00000000-0000-4000-8000-000000000206', 'active'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000301', 'TRV-001', 'Travel', 'Travel', 'Erode travel cost', 1000000, '00000000-0000-4000-8000-000000000201', 'active'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000301', 'MISC-001', 'Miscellaneous', 'Miscellaneous', 'Erode miscellaneous cost', 1000000, '00000000-0000-4000-8000-000000000201', 'active'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000302', 'LAB-001', 'Labour', 'Labour', 'Salem labour cost', 11000000, '00000000-0000-4000-8000-000000000206', 'active'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000302', 'MACH-001', 'Machinery', 'Machinery', 'Salem machinery cost', 7000000, '00000000-0000-4000-8000-000000000201', 'active'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000302', 'FUEL-001', 'Fuel', 'Fuel', 'Salem fuel cost', 3500000, '00000000-0000-4000-8000-000000000201', 'active'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000302', 'MAT-001', 'Material', 'Material', 'Salem material cost', 17000000, '00000000-0000-4000-8000-000000000206', 'active'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000302', 'TRV-001', 'Travel', 'Travel', 'Salem travel cost', 1000000, '00000000-0000-4000-8000-000000000201', 'active'),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000302', 'MISC-001', 'Miscellaneous', 'Miscellaneous', 'Salem miscellaneous cost', 1000000, '00000000-0000-4000-8000-000000000201', 'active')
on conflict (project_id, code) do update set
  name = excluded.name,
  expense_type = excluded.expense_type,
  description = excluded.description,
  budget_allocated = excluded.budget_allocated,
  responsible_department_id = excluded.responsible_department_id,
  status = excluded.status;

insert into public.approval_matrices (
  id,
  organization_id,
  workflow_type,
  department_id,
  min_amount,
  max_amount,
  level_1_role,
  level_2_role,
  level_3_role,
  level_4_role,
  final_approval_role,
  is_active
)
values
  (
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000101',
    'claim',
    '00000000-0000-4000-8000-000000000201',
    0,
    5000,
    'admin',
    'manager',
    'accounts',
    null,
    'accounts',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000502',
    '00000000-0000-4000-8000-000000000101',
    'claim',
    '00000000-0000-4000-8000-000000000201',
    5000,
    50000,
    'admin',
    'manager',
    'hod',
    'accounts',
    'accounts',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000503',
    '00000000-0000-4000-8000-000000000101',
    'leave',
    '00000000-0000-4000-8000-000000000201',
    null,
    null,
    'manager',
    'hod',
    null,
    null,
    'hod',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000504',
    '00000000-0000-4000-8000-000000000101',
    'material_request',
    '00000000-0000-4000-8000-000000000201',
    null,
    null,
    'manager',
    'hod',
    'store_admin',
    null,
    'store_admin',
    true
  )
on conflict (id) do update set
  workflow_type = excluded.workflow_type,
  department_id = excluded.department_id,
  min_amount = excluded.min_amount,
  max_amount = excluded.max_amount,
  level_1_role = excluded.level_1_role,
  level_2_role = excluded.level_2_role,
  level_3_role = excluded.level_3_role,
  level_4_role = excluded.level_4_role,
  final_approval_role = excluded.final_approval_role,
  is_active = excluded.is_active,
  updated_at = now();
