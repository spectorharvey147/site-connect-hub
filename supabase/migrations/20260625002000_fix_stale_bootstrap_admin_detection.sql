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
    join auth.users auth_user
      on auth_user.id = profile.id
    where profile.role_id in ('admin_hr', 'super_admin')
      and profile.status = 'active'
      and profile.deleted_at is null
  )
  or exists (
    select 1
    from public.bootstrap_state
    where id = true
      and status = 'running'
      and started_at > now() - interval '15 minutes'
  );
$$;

revoke all on function public.has_initial_admin() from public;
grant execute on function public.has_initial_admin() to anon, authenticated;
