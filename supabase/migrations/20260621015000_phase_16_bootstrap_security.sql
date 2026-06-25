create or replace function public.has_initial_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where role_id in ('admin_hr', 'super_admin')
      and status = 'active'
      and deleted_at is null
  );
$$;

revoke all on function public.has_initial_admin() from public;
grant execute on function public.has_initial_admin() to anon, authenticated;
