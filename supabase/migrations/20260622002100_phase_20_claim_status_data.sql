update public.claims
set status = 'final_approval_pending'
where status = 'super_admin_approval_pending';

insert into public.vendor_contracts (
  id,
  organization_id,
  contract_type,
  contract_code,
  vendor_id,
  vendor_name,
  project_id,
  project_name,
  department_id,
  department_name,
  cost_code_id,
  start_date,
  end_date,
  status,
  payment_terms,
  gst_applicable,
  tds_applicable,
  remarks,
  commercial_terms,
  created_by,
  created_by_name,
  created_at,
  updated_at
)
select
  document.record_id::uuid,
  document.organization_id,
  document.data->>'contractType',
  document.data->>'contractCode',
  document.data->>'vendorId',
  document.data->>'vendorName',
  (document.data->>'projectId')::uuid,
  document.data->>'projectName',
  nullif(document.data->>'departmentId', '')::uuid,
  document.data->>'departmentName',
  nullif(document.data->>'costCodeId', '')::uuid,
  (document.data->>'startDate')::date,
  (document.data->>'endDate')::date,
  document.data->>'status',
  coalesce(document.data->>'paymentTerms', ''),
  coalesce((document.data->>'gstApplicable')::boolean, false),
  coalesce((document.data->>'tdsApplicable')::boolean, false),
  coalesce(document.data->>'remarks', ''),
  document.data - array[
    'id', 'organizationId', 'contractType', 'contractCode', 'vendorId',
    'vendorName', 'projectId', 'projectName', 'departmentId', 'departmentName',
    'costCodeId', 'startDate', 'endDate', 'status', 'paymentTerms',
    'gstApplicable', 'tdsApplicable', 'remarks', 'createdBy',
    'createdByName', 'createdAt', 'updatedAt'
  ],
  (document.data->>'createdBy')::uuid,
  coalesce(document.data->>'createdByName', 'Unknown'),
  coalesce((document.data->>'createdAt')::timestamptz, document.created_at),
  coalesce((document.data->>'updatedAt')::timestamptz, document.updated_at)
from public.business_documents document
where document.module = 'vendors'
  and document.entity_type = 'contract'
  and document.record_id ~* '^[0-9a-f-]{36}$'
on conflict (id) do nothing;
