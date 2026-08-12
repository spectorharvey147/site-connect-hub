-- Material attachment metadata follows the visibility and mutation rules of
-- its parent request or receipt. Storage-object policies are managed
-- separately; these policies protect the relational metadata.

drop policy if exists "material request attachments visible with request"
  on public.material_request_attachments;
create policy "material request attachments visible with request"
on public.material_request_attachments for select to authenticated
using (exists (
  select 1 from public.material_requests r
  where r.id = request_id
    and r.deleted_at is null
    and (
      r.requested_by = auth.uid()
      or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
    )
));

drop policy if exists "material request attachments inserted with request"
  on public.material_request_attachments;
create policy "material request attachments inserted with request"
on public.material_request_attachments for insert to authenticated
with check (exists (
  select 1 from public.material_requests r
  where r.id = request_id
    and (
      r.requested_by = auth.uid()
      or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
    )
));

drop policy if exists "material request attachments deleted with request"
  on public.material_request_attachments;
create policy "material request attachments deleted with request"
on public.material_request_attachments for delete to authenticated
using (exists (
  select 1 from public.material_requests r
  where r.id = request_id
    and (
      r.requested_by = auth.uid()
      or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
    )
));

drop policy if exists "material receipt attachments visible with receipt"
  on public.material_receipt_attachments;
create policy "material receipt attachments visible with receipt"
on public.material_receipt_attachments for select to authenticated
using (exists (
  select 1 from public.material_receipts r
  where r.id = receipt_id
    and r.deleted_at is null
    and (
      r.received_by = auth.uid()
      or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
    )
));

drop policy if exists "material receipt attachments inserted with receipt"
  on public.material_receipt_attachments;
create policy "material receipt attachments inserted with receipt"
on public.material_receipt_attachments for insert to authenticated
with check (exists (
  select 1 from public.material_receipts r
  where r.id = receipt_id
    and (
      r.received_by = auth.uid()
      or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
    )
));

drop policy if exists "material receipt attachments deleted with receipt"
  on public.material_receipt_attachments;
create policy "material receipt attachments deleted with receipt"
on public.material_receipt_attachments for delete to authenticated
using (exists (
  select 1 from public.material_receipts r
  where r.id = receipt_id
    and (
      r.received_by = auth.uid()
      or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
    )
));
