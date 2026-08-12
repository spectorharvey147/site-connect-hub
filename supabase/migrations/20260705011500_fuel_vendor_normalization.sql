alter table public.fuel_receipts
  drop constraint if exists fuel_receipts_vendor_id_fkey;
alter table public.fuel_receipts
  add constraint fuel_receipts_vendor_id_fkey
  foreign key (vendor_id) references public.vendors(id);

notify pgrst, 'reload schema';
