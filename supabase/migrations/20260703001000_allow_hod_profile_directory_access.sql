-- HODs can view attendance for their hierarchy, so they must also be able to
-- resolve those attendance user IDs to employee names in the profile directory.
drop policy if exists "profiles are visible by role" on public.user_profiles;
create policy "profiles are visible by role"
on public.user_profiles for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_role() in (
    'manager',
    'hod',
    'admin_hr',
    'accounts_officer',
    'super_admin'
  )
);
