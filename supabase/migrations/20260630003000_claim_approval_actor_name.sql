alter table public.claim_approvals
  add column if not exists actor_name text;

update public.claim_approvals approval
set actor_name = profile.full_name
from public.user_profiles profile
where profile.id = approval.actor_id
  and (approval.actor_name is null or btrim(approval.actor_name) = '');

comment on column public.claim_approvals.actor_name is
  'Immutable display-name snapshot so claim history is readable by every authorized viewer.';
