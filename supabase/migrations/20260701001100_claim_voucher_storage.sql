insert into storage.buckets(id,name,public) values('claim-vouchers','claim-vouchers',false)
on conflict(id) do update set public=false;
drop policy if exists "claim voucher objects visible to authorized users" on storage.objects;
create policy "claim voucher objects visible to authorized users" on storage.objects for select to authenticated
using(bucket_id='claim-vouchers' and ((storage.foldername(name))[1]=public.current_organization_id()::text or public.current_user_role()='super_admin'));
drop policy if exists "finance uploads claim voucher objects" on storage.objects;
create policy "finance uploads claim voucher objects" on storage.objects for insert to authenticated
with check(bucket_id='claim-vouchers' and (storage.foldername(name))[1]=public.current_organization_id()::text and public.current_user_role() in ('accounts_officer','super_admin'));
