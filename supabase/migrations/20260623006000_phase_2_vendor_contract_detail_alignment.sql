-- Phase 2: make vendor contract operational terms first-class records.

alter table public.vendor_contracts
  add column if not exists contract_title text,
  add column if not exists updated_by uuid references public.user_profiles(id);

update public.vendor_contracts
set contract_title = coalesce(contract_title, contract_code)
where contract_title is null;

alter table public.labour_contract_terms
  add column if not exists vendor_contract_id uuid references public.vendor_contracts(id) on delete cascade,
  add column if not exists male_labour_rate_day numeric(14,2) not null default 0,
  add column if not exists female_labour_rate_day numeric(14,2) not null default 0,
  add column if not exists supervisor_rate_day numeric(14,2) not null default 0,
  add column if not exists skilled_labour_rate_day numeric(14,2) not null default 0,
  add column if not exists unskilled_labour_rate_day numeric(14,2) not null default 0,
  add column if not exists ot_rate_per_hour numeric(14,2) not null default 0,
  add column if not exists default_payee_type text check (default_payee_type in ('vendor', 'incharge', 'individual')),
  add column if not exists default_incharge_name text,
  add column if not exists default_incharge_phone text,
  add column if not exists default_incharge_payment_mode text,
  add column if not exists remarks text,
  add column if not exists updated_by uuid references public.user_profiles(id);

update public.labour_contract_terms
set vendor_contract_id = coalesce(vendor_contract_id, contract_id),
    male_labour_rate_day = coalesce(male_labour_rate_day, 0),
    female_labour_rate_day = coalesce(female_labour_rate_day, 0),
    supervisor_rate_day = coalesce(supervisor_rate_day, 0),
    skilled_labour_rate_day = coalesce(skilled_labour_rate_day, 0),
    unskilled_labour_rate_day = coalesce(unskilled_labour_rate_day, 0),
    ot_rate_per_hour = coalesce(ot_rate_per_hour, 0)
where vendor_contract_id is null;

create unique index if not exists idx_labour_contract_terms_vendor_contract
  on public.labour_contract_terms(vendor_contract_id)
  where vendor_contract_id is not null;

create unique index if not exists idx_machinery_contract_terms_vendor_contract
  on public.machinery_contract_terms(vendor_contract_id)
  where vendor_contract_id is not null;

create unique index if not exists idx_fuel_contracts_vendor_contract
  on public.fuel_contracts(vendor_contract_id)
  where vendor_contract_id is not null;

alter table public.machinery_contract_machines
  add column if not exists registration_number text,
  add column if not exists capacity text,
  add column if not exists ownership text check (ownership in ('company', 'rented', 'hired')),
  add column if not exists remarks text,
  add column if not exists updated_by uuid references public.user_profiles(id);

create index if not exists idx_vendor_contract_rate_cards_contract
  on public.vendor_contract_rate_cards(contract_id, rate_code, status);
