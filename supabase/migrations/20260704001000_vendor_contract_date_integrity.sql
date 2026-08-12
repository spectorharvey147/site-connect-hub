alter table public.vendor_contracts
  drop constraint if exists vendor_contracts_check;

alter table public.vendor_contracts
  add constraint vendor_contracts_date_range_check check (end_date > start_date);
