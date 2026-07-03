-- Avoid recursive RLS evaluation when a conversation member checks membership.
create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = target_conversation_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

drop policy if exists "conversation members visible to conversation users"
  on public.conversation_members;
create policy "conversation members visible to conversation users"
on public.conversation_members for select
to authenticated
using (
  public.current_user_role() in ('admin_hr', 'super_admin')
  or user_id = auth.uid()
  or public.is_conversation_member(conversation_id)
);

-- A machinery term can exist independently of a vendor_contract. Give machines
-- a real FK to their owning term so PostgREST can discover the relationship.
alter table public.machinery_contract_machines
  alter column contract_id drop not null,
  add column if not exists contract_term_id uuid
    references public.machinery_contract_terms(id) on delete cascade;

update public.machinery_contract_machines machine
set contract_term_id = term.id
from public.machinery_contract_terms term
where machine.contract_term_id is null
  and (
    machine.vendor_contract_id = term.vendor_contract_id
    or machine.contract_id = term.vendor_contract_id
  )
  and term.vendor_contract_id is not null;

create index if not exists idx_machinery_contract_machines_term
  on public.machinery_contract_machines(contract_term_id);

create unique index if not exists idx_machinery_contract_machines_term_number
  on public.machinery_contract_machines(contract_term_id, machine_number)
  where contract_term_id is not null;

notify pgrst, 'reload schema';
