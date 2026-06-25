alter table if exists public.claim_attachments
  add column if not exists file_bucket text,
  add column if not exists file_path text;

update public.claim_attachments
set
  file_bucket = coalesce(file_bucket, 'claim-attachments'),
  file_path = coalesce(file_path, file_url)
where file_bucket is null
   or file_path is null;

insert into storage.buckets (id, name, public)
values
  ('vendor-contracts', 'vendor-contracts', false),
  ('payment-proofs', 'payment-proofs', false),
  ('sap-exports', 'sap-exports', false)
on conflict (id) do update set
  public = excluded.public;

drop policy if exists "organization members read storage objects" on storage.objects;
create policy "organization members read storage objects"
on storage.objects for select
to authenticated
using (
  bucket_id in (
    'organization-logos',
    'profile-photos',
    'claim-attachments',
    'leave-documents',
    'dpr-photos',
    'task-attachments',
    'message-attachments',
    'vendor-bills',
    'material-documents',
    'fuel-receipts',
    'vendor-contracts',
    'payment-proofs',
    'sap-exports'
  )
  and (
    (storage.foldername(name))[1] = public.current_organization_id()::text
    or public.current_user_role() = 'super_admin'
  )
);

drop policy if exists "organization members upload storage objects" on storage.objects;
create policy "organization members upload storage objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id in (
    'organization-logos',
    'profile-photos',
    'claim-attachments',
    'leave-documents',
    'dpr-photos',
    'task-attachments',
    'message-attachments',
    'vendor-bills',
    'material-documents',
    'fuel-receipts',
    'vendor-contracts',
    'payment-proofs',
    'sap-exports'
  )
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);
