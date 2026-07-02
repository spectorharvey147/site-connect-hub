create or replace function public.activate_current_user_after_password_setup()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_profiles
  set status = 'active', updated_at = now()
  where id = auth.uid()
    and status = 'invited';
  return found;
end;
$$;

revoke all on function public.activate_current_user_after_password_setup() from public;
grant execute on function public.activate_current_user_after_password_setup() to authenticated;
