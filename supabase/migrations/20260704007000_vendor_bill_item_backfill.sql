-- Historical/manual bills must remain itemized for audit and voucher support.
insert into public.vendor_bill_items
(organization_id,project_id,department_id,cost_code_id,vendor_id,vendor_bill_id,source_type,description,quantity,unit,rate,amount,created_by)
select b.organization_id,b.project_id,b.department_id,b.cost_code_id,b.vendor_id,b.id,
  case b.bill_type::text when 'labor' then 'labour' when 'service' then 'general' else b.bill_type::text end,
  'Manual invoice '||coalesce(nullif(b.invoice_number,''),b.bill_number),1,'invoice',b.base_amount,b.base_amount,coalesce(b.created_by,b.submitted_by)
from public.vendor_bills b
where not exists(select 1 from public.vendor_bill_items i where i.vendor_bill_id=b.id);
