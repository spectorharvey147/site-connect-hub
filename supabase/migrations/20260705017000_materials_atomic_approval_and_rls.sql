create unique index if not exists idx_material_stock_reference_material_type
on public.material_stock_ledger(reference_id,material_id,transaction_type)
where reference_id is not null;

create or replace function public.guard_material_request_transition()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor_role text;
begin
 if auth.uid() is null then return new; end if; actor_role:=public.current_user_role();
 if old.status in ('approved','received','rejected') and new.status is distinct from old.status then raise exception 'Final material requests cannot be reopened'; end if;
 if new.status='approved' and old.status<>'submitted' then raise exception 'Only submitted material requests can be approved'; end if;
 if new.status='approved' and actor_role not in ('manager','hod','admin_hr','super_admin') then raise exception 'Only an authorised approver can approve material requests'; end if;
 if new.approved_by is distinct from old.approved_by and new.approved_by is distinct from auth.uid() then raise exception 'approved_by must match the authenticated approver'; end if;
 return new;
end;$$;
drop trigger if exists guard_material_request_transition on public.material_requests;
create trigger guard_material_request_transition before update on public.material_requests for each row execute function public.guard_material_request_transition();

create or replace function public.guard_material_receipt_transition()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor_role text;
begin
 if auth.uid() is null then return new; end if; actor_role:=public.current_user_role();
 if old.status in ('verified','rejected') and new.status is distinct from old.status then raise exception 'Final material receipts cannot be reopened'; end if;
 if new.status='verified' and old.status<>'received' then raise exception 'Only received material receipts can be verified'; end if;
 if new.status='verified' and actor_role not in ('manager','hod','admin_hr','super_admin') then raise exception 'Only an authorised verifier can verify material receipts'; end if;
 if new.verified_by is distinct from old.verified_by and new.verified_by is distinct from auth.uid() then raise exception 'verified_by must match the authenticated verifier'; end if;
 return new;
end;$$;
drop trigger if exists guard_material_receipt_transition on public.material_receipts;
create trigger guard_material_receipt_transition before update on public.material_receipts for each row execute function public.guard_material_receipt_transition();

create or replace function public.approve_material_request(target_request_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare request_row public.material_requests%rowtype; declare actor_id uuid:=auth.uid(); declare actor_role text:=public.current_user_role();
begin
 if actor_id is null or actor_role not in ('manager','hod','admin_hr','super_admin') then raise exception 'Only an authorised approver can approve material requests'; end if;
 select * into request_row from public.material_requests where id=target_request_id for update;
 if not found then raise exception 'Material request not found'; end if;
 if request_row.status<>'submitted' then raise exception 'Only submitted material requests can be approved'; end if;
 if not exists(select 1 from public.material_request_items where request_id=request_row.id and quantity>0) then raise exception 'Material request requires at least one positive item'; end if;
 update public.material_requests set status='approved',approved_by=actor_id,approved_at=now() where id=request_row.id;
 return request_row.id;
end;$$;

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
   select coalesce(balance_quantity,0) into current_balance from public.material_stock_ledger where organization_id=receipt_row.organization_id and project_id=receipt_row.project_id and material_id=item.material_id order by transaction_date desc,created_at desc,id desc limit 1;
   insert into public.material_stock_ledger(organization_id,project_id,department_id,cost_code_id,material_id,transaction_date,transaction_type,reference_id,quantity_in,quantity_out,balance_quantity,status,created_by)
   values(receipt_row.organization_id,receipt_row.project_id,receipt_row.department_id,receipt_row.cost_code_id,item.material_id,receipt_row.receipt_date,case when item.condition='damaged' then 'damage' else 'receipt' end,receipt_row.id,case when item.condition='damaged' then 0 else item.qty_received end,case when item.condition='damaged' then item.qty_received else 0 end,current_balance+case when item.condition='damaged' then -item.qty_received else item.qty_received end,'posted',actor_id);
 end loop;
 update public.material_receipts set status='verified',verified_by=actor_id,verified_at=now() where id=receipt_row.id;
 if receipt_row.linked_request_id is not null then update public.material_requests set status='received' where id=receipt_row.linked_request_id and status='approved'; end if;
 return receipt_row.id;
end;$$;
revoke all on function public.approve_material_request(uuid) from public; grant execute on function public.approve_material_request(uuid) to authenticated;
revoke all on function public.verify_material_receipt(uuid) from public; grant execute on function public.verify_material_receipt(uuid) to authenticated;

drop policy if exists "materials visible to field roles" on public.materials;
create policy "materials visible to field roles" on public.materials for select to authenticated using(public.current_user_role() in ('site_staff','manager','hod','admin_hr','super_admin'));
drop policy if exists "material requests visible to owner manager or admin" on public.material_requests;
create policy "material requests visible to owner manager or admin" on public.material_requests for select to authenticated using(deleted_at is null and(requested_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin')));
drop policy if exists "material requests created by field roles" on public.material_requests;
create policy "material requests created by field roles" on public.material_requests for insert to authenticated with check(requested_by=auth.uid() and public.current_user_role() in ('site_staff','manager','hod','admin_hr','super_admin'));
drop policy if exists "material requests updated by owner manager or admin" on public.material_requests;
create policy "material requests updated by owner manager or admin" on public.material_requests for update to authenticated using(requested_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin')) with check(requested_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin'));
drop policy if exists "material receipts visible to owner manager or admin" on public.material_receipts;
create policy "material receipts visible to owner manager or admin" on public.material_receipts for select to authenticated using(deleted_at is null and(received_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin')));
drop policy if exists "material receipts created by field roles" on public.material_receipts;
create policy "material receipts created by field roles" on public.material_receipts for insert to authenticated with check(received_by=auth.uid() and public.current_user_role() in ('site_staff','manager','hod','admin_hr','super_admin'));
drop policy if exists "material receipts updated by owner manager or admin" on public.material_receipts;
create policy "material receipts updated by owner manager or admin" on public.material_receipts for update to authenticated using(received_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin')) with check(received_by=auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin'));

notify pgrst,'reload schema';
