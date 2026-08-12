alter table public.fuel_stock_ledger
  alter column fuel_type type public.fuel_type
  using fuel_type::public.fuel_type;

notify pgrst,'reload schema';
