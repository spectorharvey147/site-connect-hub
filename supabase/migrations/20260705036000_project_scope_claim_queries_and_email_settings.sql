create or replace function public.can_access_project(target_project_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select target_project_id is not null and (
    public.current_user_role() in ('admin_hr','super_admin','accounts_officer')
    or exists(select 1 from public.user_project_assignments a where a.user_id=auth.uid() and a.project_id=target_project_id and a.status='active' and a.start_date<=current_date and(a.end_date is null or a.end_date>=current_date))
  )
$$;
revoke all on function public.can_access_project(uuid) from public;
grant execute on function public.can_access_project(uuid) to authenticated;

-- Restrictive policies are ANDed with existing workflow policies, preventing
-- cross-project reads without weakening existing owner/role rules.
do $$ declare t text; begin
 foreach t in array array[
  'attendance','casual_labour_attendance','casual_labour_work_allocations','casual_labour_bills',
  'machine_assets','machine_logs','machine_breakdowns','machinery_contracts','machinery_contract_terms','machinery_contract_machines','machinery_usage_bills',
  'fuel_contracts','fuel_receipts','fuel_issues','fuel_stock_ledger','fuel_vendor_deposits','fuel_vendor_ledger','fuel_cash_expenses',
  'vendor_contracts','vendor_bills'
 ] loop
 execute format('drop policy if exists project_scope_read on public.%I',t);
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='project_id') then
    execute format('create policy project_scope_read on public.%I as restrictive for select to authenticated using(public.can_access_project(project_id))',t);
  end if;
 end loop;
end $$;

drop policy if exists project_scope_read on public.casual_labour_workers;
create policy project_scope_read on public.casual_labour_workers as restrictive for select to authenticated using(
 public.current_user_role() in('admin_hr','super_admin','accounts_officer') or created_by=auth.uid()
 or exists(select 1 from public.casual_labour_attendance_rows r join public.casual_labour_attendance a on a.id=r.attendance_id where r.worker_id=casual_labour_workers.id and public.can_access_project(a.project_id))
);

create table if not exists public.claim_queries(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 claim_id uuid not null references public.claims(id) on delete cascade,
 raised_by uuid not null references public.user_profiles(id),
 assigned_to uuid not null references public.user_profiles(id),
 query_type text not null default 'clarification' check(query_type in('clarification','missing_attachment','policy','amount','other')),
 subject text not null,
 message text not null,
 attachment_required boolean not null default false,
 status text not null default 'open' check(status in('open','responded','resolved','closed')),
 response_message text,
 responded_by uuid references public.user_profiles(id),
 responded_at timestamptz,
 resolved_by uuid references public.user_profiles(id),
 resolved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.claim_query_attachments(
 id uuid primary key default gen_random_uuid(),
 query_id uuid not null references public.claim_queries(id) on delete cascade,
 claim_id uuid not null references public.claims(id) on delete cascade,
 claim_attachment_id uuid not null references public.claim_attachments(id) on delete cascade,
 added_by uuid not null references public.user_profiles(id),
 created_at timestamptz not null default now(),
 unique(query_id,claim_attachment_id)
);
create index if not exists idx_claim_queries_claim_status on public.claim_queries(claim_id,status,created_at desc);
create index if not exists idx_claim_queries_assigned on public.claim_queries(assigned_to,status,created_at desc);
drop trigger if exists set_claim_queries_updated_at on public.claim_queries;
create trigger set_claim_queries_updated_at before update on public.claim_queries for each row execute function public.set_updated_at();
alter table public.claim_queries enable row level security;
alter table public.claim_query_attachments enable row level security;
create policy "claim queries visible with claim" on public.claim_queries for select to authenticated using(
 organization_id=public.current_organization_id() and exists(select 1 from public.claims c where c.id=claim_id)
);
create policy "workflow roles raise claim queries" on public.claim_queries for insert to authenticated with check(
 organization_id=public.current_organization_id() and raised_by=auth.uid() and public.current_user_role() in('admin_hr','manager','hod','accounts_officer','super_admin')
 and exists(select 1 from public.claims c where c.id=claim_id)
);
create policy "query participants update claim queries" on public.claim_queries for update to authenticated
using(organization_id=public.current_organization_id() and(assigned_to=auth.uid() or raised_by=auth.uid() or public.current_user_role() in('admin_hr','super_admin')))
with check(organization_id=public.current_organization_id() and(assigned_to=auth.uid() or raised_by=auth.uid() or public.current_user_role() in('admin_hr','super_admin')));
create policy "query attachments visible with query" on public.claim_query_attachments for select to authenticated using(exists(select 1 from public.claim_queries q where q.id=query_id));
create policy "query assignee adds claim attachment" on public.claim_query_attachments for insert to authenticated with check(added_by=auth.uid() and exists(select 1 from public.claim_queries q where q.id=query_id and q.assigned_to=auth.uid() and q.claim_id=claim_id));

update public.app_settings set notifications=jsonb_set(coalesce(notifications,'{}'::jsonb),'{approvalBaseUrl}',coalesce(notifications->'approvalBaseUrl','""'::jsonb),true) where id='default';
notify pgrst,'reload schema';
