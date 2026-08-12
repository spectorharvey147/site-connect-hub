drop index if exists public.labour_payees_contract_type_name_uidx;

alter table public.labour_payees
  drop constraint if exists labour_payees_contract_type_name_key;

alter table public.labour_payees
  add constraint labour_payees_contract_type_name_key
  unique (contract_id, payee_type, payee_name);
