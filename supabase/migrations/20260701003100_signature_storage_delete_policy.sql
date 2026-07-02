create policy "signature objects deleted by authorized users" on storage.objects for delete to authenticated
using(bucket_id='user-signatures' and ((storage.foldername(name))[2]=auth.uid()::text or public.current_user_role() in ('admin_hr','super_admin')));
