\set ON_ERROR_STOP on

begin;

delete from storage.objects
where bucket_id in (
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
);

commit;
