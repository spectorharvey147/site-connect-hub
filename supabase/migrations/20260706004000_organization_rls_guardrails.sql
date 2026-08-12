-- A restrictive organization guard composes with the existing role/project policies.
-- Restrictive policies are ANDed with permissive policies, preventing any role-only
-- policy from leaking rows across organizations.
do $$
declare row record;
begin
  for row in
    select c.table_name
    from information_schema.columns c
    join pg_class pc on pc.relname=c.table_name
    join pg_namespace pn on pn.oid=pc.relnamespace and pn.nspname='public'
    where c.table_schema='public' and c.column_name='organization_id'
      and pc.relrowsecurity
  loop
    execute format('drop policy if exists "organization isolation select" on public.%I',row.table_name);
    execute format('create policy "organization isolation select" on public.%I as restrictive for select to authenticated using (organization_id=public.current_organization_id())',row.table_name);
    execute format('drop policy if exists "organization isolation insert" on public.%I',row.table_name);
    execute format('create policy "organization isolation insert" on public.%I as restrictive for insert to authenticated with check (organization_id=public.current_organization_id())',row.table_name);
    execute format('drop policy if exists "organization isolation update" on public.%I',row.table_name);
    execute format('create policy "organization isolation update" on public.%I as restrictive for update to authenticated using (organization_id=public.current_organization_id()) with check (organization_id=public.current_organization_id())',row.table_name);
    execute format('drop policy if exists "organization isolation delete" on public.%I',row.table_name);
    execute format('create policy "organization isolation delete" on public.%I as restrictive for delete to authenticated using (organization_id=public.current_organization_id())',row.table_name);
  end loop;
end $$;

drop policy if exists "organization storage isolation select" on storage.objects;
create policy "organization storage isolation select" on storage.objects as restrictive for select to authenticated
using (
  bucket_id not in ('claim-attachments','leave-documents','dpr-photos','task-attachments','message-attachments','vendor-bills','material-documents','fuel-receipts','vendor-contracts','payment-proofs','sap-exports','claim-vouchers','user-signatures','profile-photos','attendance-selfies')
  or (storage.foldername(name))[1]=public.current_organization_id()::text
);
drop policy if exists "organization storage isolation insert" on storage.objects;
create policy "organization storage isolation insert" on storage.objects as restrictive for insert to authenticated
with check (
  bucket_id not in ('claim-attachments','leave-documents','dpr-photos','task-attachments','message-attachments','vendor-bills','material-documents','fuel-receipts','vendor-contracts','payment-proofs','sap-exports','claim-vouchers','user-signatures','profile-photos','attendance-selfies')
  or (storage.foldername(name))[1]=public.current_organization_id()::text
);
drop policy if exists "organization storage isolation update" on storage.objects;
create policy "organization storage isolation update" on storage.objects as restrictive for update to authenticated
using ((storage.foldername(name))[1]=public.current_organization_id()::text)
with check ((storage.foldername(name))[1]=public.current_organization_id()::text);
drop policy if exists "organization storage isolation delete" on storage.objects;
create policy "organization storage isolation delete" on storage.objects as restrictive for delete to authenticated
using ((storage.foldername(name))[1]=public.current_organization_id()::text);
