-- Required by vendorContractService's deterministic labour payee upsert.
-- A contract may have multiple payee types/names, but never duplicate the
-- same logical payee row.
create unique index if not exists labour_payees_contract_type_name_uidx
  on public.labour_payees(contract_id, payee_type, payee_name)
  where contract_id is not null;
