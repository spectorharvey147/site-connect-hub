alter type public.claim_status add value if not exists 'partial_paid';
alter type public.claim_status add value if not exists 'pending_payment';

alter table public.payment_vouchers
  add column if not exists paid_amount numeric(12, 2) not null default 0;

update public.approval_matrices
set
  final_approval_role = case
    when coalesce(min_amount, 0) >= 50000 then 'super_admin'
    else 'hod'
  end,
  level_3_role = case
    when level_3_role is null or level_3_role = 'accounts' then 'hod'
    else level_3_role
  end,
  level_4_role = case
    when coalesce(min_amount, 0) >= 50000 then 'super_admin'
    else level_4_role
  end
where workflow_type = 'claim'
  and final_approval_role = 'accounts';

create index if not exists idx_business_documents_vendor_contracts
on public.business_documents (organization_id, project_id, status, document_date)
where module = 'vendors' and entity_type = 'contract';

drop policy if exists "claims visible by ownership or role" on public.claims;
create policy "claims visible by ownership or role"
on public.claims for select
to authenticated
using (
  deleted_at is null
  and (
    user_id = auth.uid()
    or requester_user_id = auth.uid()
    or reporting_manager_id = auth.uid()
    or hod_user_id = auth.uid()
    or public.current_user_role() in ('admin_hr', 'accounts_officer', 'super_admin')
  )
);

drop policy if exists "claims updated by owner or workflow roles" on public.claims;
create policy "claims updated by owner or workflow roles"
on public.claims for update
to authenticated
using (
  user_id = auth.uid()
  or requester_user_id = auth.uid()
  or reporting_manager_id = auth.uid()
  or hod_user_id = auth.uid()
  or public.current_user_role() in ('admin_hr', 'accounts_officer', 'super_admin')
)
with check (
  user_id = auth.uid()
  or requester_user_id = auth.uid()
  or reporting_manager_id = auth.uid()
  or hod_user_id = auth.uid()
  or public.current_user_role() in ('admin_hr', 'accounts_officer', 'super_admin')
);
