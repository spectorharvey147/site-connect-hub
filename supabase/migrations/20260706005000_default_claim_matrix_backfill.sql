-- Preserve every custom matrix. Add the normal claim route only where an
-- organization has no active claim matrix, and list existing master routes for review.
insert into public.approval_matrices(
  organization_id,workflow_type,level_1_role,level_2_role,level_3_role,level_4_role,final_approval_role,is_active
)
select o.id,'claim','admin','manager','hod','accounts','hod',true
from public.organizations o
where not exists(
  select 1 from public.approval_matrices m
  where m.organization_id=o.id and m.workflow_type='claim' and m.is_active
);

create table if not exists public.approval_matrix_manual_reviews(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_matrix_id uuid not null references public.approval_matrices(id) on delete cascade,
  reason text not null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  unique(approval_matrix_id,reason)
);
insert into public.approval_matrix_manual_reviews(organization_id,approval_matrix_id,reason)
select organization_id,id,'Custom claim matrix includes Master Super Admin; confirm that exceptional approval is intentional.'
from public.approval_matrices
where workflow_type='claim' and is_active
  and 'super_admin' in (level_1_role,level_2_role,level_3_role,level_4_role,final_approval_role)
on conflict do nothing;
alter table public.approval_matrix_manual_reviews enable row level security;
create policy "matrix reviews visible to master administrators" on public.approval_matrix_manual_reviews for select to authenticated
using(organization_id=public.current_organization_id() and public.current_user_role()='super_admin');
create policy "matrix reviews updated by master administrators" on public.approval_matrix_manual_reviews for update to authenticated
using(organization_id=public.current_organization_id() and public.current_user_role()='super_admin')
with check(organization_id=public.current_organization_id() and public.current_user_role()='super_admin');
