drop policy if exists "admins delete vendor contracts" on public.vendor_contracts;
create policy "admins delete vendor contracts"
on public.vendor_contracts for delete to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('admin_hr', 'super_admin')
);
