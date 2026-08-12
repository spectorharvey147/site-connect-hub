-- Private conversations require membership; finance documents require finance scope.
create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.conversation_members where conversation_id=target_conversation_id and user_id=auth.uid())
$$;
create or replace function public.is_conversation_owner(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=auth.uid() and member_role='owner')
$$;
revoke all on function public.is_conversation_member(uuid),public.is_conversation_owner(uuid) from public;
grant execute on function public.is_conversation_member(uuid),public.is_conversation_owner(uuid) to authenticated;

drop policy if exists "conversations visible to members or admins" on public.conversations;
create policy "conversations visible to members" on public.conversations for select to authenticated
using(deleted_at is null and organization_id=public.current_organization_id() and public.is_conversation_member(id));
drop policy if exists "conversation creators or admins update conversations" on public.conversations;
create policy "conversation owners update conversations" on public.conversations for update to authenticated
using(organization_id=public.current_organization_id() and(created_by=auth.uid() or public.is_conversation_owner(id)))
with check(organization_id=public.current_organization_id() and(created_by=auth.uid() or public.is_conversation_owner(id)));

drop policy if exists "conversation members visible to conversation users" on public.conversation_members;
create policy "conversation members visible to conversation users" on public.conversation_members for select to authenticated
using(public.is_conversation_member(conversation_id));

drop policy if exists "messages visible to conversation members" on public.messages;
create policy "messages visible to conversation members" on public.messages for select to authenticated
using(deleted_at is null and public.is_conversation_member(conversation_id));

drop policy if exists "organization members read business documents" on public.business_documents;
create policy "scoped organization members read business documents" on public.business_documents for select to authenticated using(
 organization_id=public.current_organization_id() and(
  owner_user_id=auth.uid() or public.current_user_role() in('admin_hr','super_admin')
  or(module in('claims','accounts','payments','sap') and public.current_user_role()='accounts_officer')
  or(module not in('claims','accounts','payments','sap') and(
    public.current_user_role() in('manager','hod')
    or exists(select 1 from public.user_project_assignments a where a.user_id=auth.uid() and a.project_id=business_documents.project_id and a.status='active' and a.start_date<=current_date and(a.end_date is null or a.end_date>=current_date))
  ))
 ));
