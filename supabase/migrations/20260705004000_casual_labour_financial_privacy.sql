-- Replace broad organization-only reads with module-specific least-privilege rules.
drop policy if exists "labour_rosters_read" on public.labour_rosters;
create policy "labour_rosters_operational_read"
on public.labour_rosters for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('site_staff', 'manager', 'hod', 'admin_hr', 'super_admin')
);

drop policy if exists "casual_labour_attendance_items_read" on public.casual_labour_attendance_items;
create policy "casual_labour_attendance_items_operational_read"
on public.casual_labour_attendance_items for select to authenticated
using (
  organization_id = public.current_organization_id()
  and exists (
    select 1 from public.casual_labour_attendance attendance
    where attendance.id = attendance_id
      and attendance.deleted_at is null
      and (
        attendance.submitted_by = auth.uid()
        or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "casual_labour_work_allocations_organization_read" on public.casual_labour_work_allocations;
create policy "casual_labour_work_allocations_operational_read"
on public.casual_labour_work_allocations for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('site_staff', 'manager', 'hod', 'admin_hr', 'super_admin')
);

drop policy if exists "casual_labour_bills_organization_read" on public.casual_labour_bills;
create policy "casual_labour_bills_authorized_read"
on public.casual_labour_bills for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.current_user_role() in ('manager', 'hod', 'accounts_officer', 'admin_hr', 'super_admin')
    or exists (
      select 1 from public.casual_labour_attendance attendance
      where attendance.id = attendance_id
        and attendance.submitted_by = auth.uid()
    )
  )
);

drop policy if exists "labour_advance_deductions_read" on public.labour_advance_deductions;
create policy "labour_advance_deductions_finance_read"
on public.labour_advance_deductions for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('manager', 'hod', 'accounts_officer', 'admin_hr', 'super_admin')
);

notify pgrst, 'reload schema';
