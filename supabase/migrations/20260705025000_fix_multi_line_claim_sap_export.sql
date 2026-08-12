-- A claim legitimately produces multiple debit/credit lines (one per expense
-- grouping). The former side-level unique key rejected the second line.
drop index if exists public.uq_sap_batch_voucher_claim_side;
create index if not exists idx_sap_items_batch_voucher_claim_side
  on public.claim_sap_export_items(sap_batch_id,voucher_id,claim_id,debit_credit);

comment on index public.idx_sap_items_batch_voucher_claim_side is
  'Lookup index only: multi-category claims require multiple rows per posting side.';
