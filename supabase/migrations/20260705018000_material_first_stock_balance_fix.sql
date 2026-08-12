create or replace function public.verify_material_receipt(target_receipt_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare receipt_row public.material_receipts%rowtype; declare item record; declare actor_id uuid:=auth.uid(); declare actor_role text:=public.current_user_role(); declare current_balance numeric(14,3);
begin
 if actor_id is null or actor_role not in ('manager','hod','admin_hr','super_admin') then raise exception 'Only an authorised verifier can verify material receipts'; end if;
 select * into receipt_row from public.material_receipts where id=target_receipt_id for update;
 if not found then raise exception 'Material receipt not found'; end if;
 if receipt_row.status<>'received' then raise exception 'Only received material receipts can be verified'; end if;
 if not(receipt_row.materials_checked and receipt_row.quantities_match_invoice and receipt_row.quality_acceptable) then raise exception 'Material receipt checklist is incomplete'; end if;
 if not exists(select 1 from public.material_receipt_items where receipt_id=receipt_row.id and qty_received>0) then raise exception 'Material receipt requires positive received quantities'; end if;
 for item in select * from public.material_receipt_items where receipt_id=receipt_row.id order by id loop
   select coalesce((select balance_quantity from public.material_stock_ledger where organization_id=receipt_row.organization_id and project_id=receipt_row.project_id and material_id=item.material_id order by transaction_date desc,created_at desc,id desc limit 1),0) into current_balance;
   insert into public.material_stock_ledger(organization_id,project_id,department_id,cost_code_id,material_id,transaction_date,transaction_type,reference_id,quantity_in,quantity_out,balance_quantity,status,created_by)
   values(receipt_row.organization_id,receipt_row.project_id,receipt_row.department_id,receipt_row.cost_code_id,item.material_id,receipt_row.receipt_date,case when item.condition='damaged' then 'damage' else 'receipt' end,receipt_row.id,case when item.condition='damaged' then 0 else item.qty_received end,case when item.condition='damaged' then item.qty_received else 0 end,current_balance+case when item.condition='damaged' then -item.qty_received else item.qty_received end,'posted',actor_id);
 end loop;
 update public.material_receipts set status='verified',verified_by=actor_id,verified_at=now() where id=receipt_row.id;
 if receipt_row.linked_request_id is not null then update public.material_requests set status='received' where id=receipt_row.linked_request_id and status='approved'; end if;
 return receipt_row.id;
end;$$;
