-- Align bootstrap locking and profile visibility with the organization master role model.

create or replace function public.has_initial_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_profiles profile
    join auth.users auth_user on auth_user.id = profile.id
    where profile.role_id = 'super_admin'
      and profile.status = 'active'
      and profile.deleted_at is null
  ) or exists (
    select 1
    from public.bootstrap_state
    where id = true
      and status = 'running'
      and started_at > now() - interval '15 minutes'
  );
$$;

revoke all on function public.has_initial_admin() from public;
grant execute on function public.has_initial_admin() to anon, authenticated;

drop policy if exists "profiles visible to organization directory" on public.user_profiles;
drop policy if exists "Users can read profiles" on public.user_profiles;
drop policy if exists "hod can read profile directory" on public.user_profiles;
create policy "profiles visible within organization"
on public.user_profiles for select to authenticated
using (
  deleted_at is null
  and organization_id = public.current_organization_id()
  and (
    id = auth.uid()
    or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'accounts_officer', 'super_admin')
  )
);

drop policy if exists "attendance selfie access" on storage.objects;
create policy "attendance selfies scoped to organization"
on storage.objects for select to authenticated
using (
  bucket_id = 'attendance-selfies'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "users upload attendance selfies" on storage.objects;
create policy "users upload own organization attendance selfies"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'attendance-selfies'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);
