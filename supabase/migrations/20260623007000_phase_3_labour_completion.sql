-- Phase 3: complete labour contract, payee, roster and attendance detail fields.

alter table public.labour_payees
  add column if not exists vendor_contract_id uuid references public.vendor_contracts(id) on delete cascade,
  add column if not exists payment_mode text,
  add column if not exists upi_id text,
  add column if not exists bank_name text,
  add column if not exists account_number text,
  add column if not exists ifsc text,
  add column if not exists remarks text,
  add column if not exists updated_by uuid references public.user_profiles(id);

update public.labour_payees
set vendor_contract_id = coalesce(vendor_contract_id, contract_id),
    payment_mode = coalesce(payment_mode, payment_details)
where vendor_contract_id is null
   or payment_mode is null;

create unique index if not exists idx_labour_payees_contract_type_name
  on public.labour_payees(contract_id, payee_type, payee_name)
  where contract_id is not null;

alter table public.labour_rosters
  add column if not exists vendor_contract_id uuid references public.vendor_contracts(id) on delete cascade,
  add column if not exists gender text check (gender in ('male','female','other')),
  add column if not exists skill_type text check (skill_type in ('supervisor','skilled','unskilled','general')),
  add column if not exists phone text,
  add column if not exists id_proof_type text,
  add column if not exists id_proof_number text,
  add column if not exists ot_rate_override numeric(14,2) not null default 0,
  add column if not exists default_payee_id uuid references public.labour_payees(id),
  add column if not exists updated_by uuid references public.user_profiles(id);

update public.labour_rosters
set vendor_contract_id = coalesce(vendor_contract_id, contract_id),
    gender = coalesce(gender, case when category = 'female' then 'female' else 'male' end),
    skill_type = coalesce(skill_type, case when category = 'supervisor' then 'supervisor' else 'general' end)
where vendor_contract_id is null
   or gender is null
   or skill_type is null;

alter table public.casual_labour_work_allocations
  add column if not exists linked_attendance_ids uuid[] not null default '{}';

create index if not exists idx_labour_payees_vendor_contract
  on public.labour_payees(vendor_contract_id, status);
create index if not exists idx_labour_rosters_vendor_contract
  on public.labour_rosters(vendor_contract_id, status);
create index if not exists idx_labour_attendance_items_entry_mode
  on public.casual_labour_attendance_items(entry_mode, status);
