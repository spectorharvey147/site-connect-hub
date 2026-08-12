drop policy if exists "role scoped vendor contract read" on public.vendor_contracts;
create policy "role scoped vendor contract read"
on public.vendor_contracts for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.current_user_role() in ('admin_hr', 'super_admin', 'accounts_officer')
    or (
      public.current_user_role() = 'hod'
      and department_id = (
        select department_id from public.user_profiles where id = auth.uid()
      )
    )
    or (
      public.current_user_role() in ('manager', 'site_staff')
      and exists (
        select 1 from public.user_project_assignments assignment
        where assignment.user_id = auth.uid()
          and assignment.project_id = vendor_contracts.project_id
          and assignment.status = 'active'
          and (assignment.end_date is null or assignment.end_date >= current_date)
      )
    )
  )
);
