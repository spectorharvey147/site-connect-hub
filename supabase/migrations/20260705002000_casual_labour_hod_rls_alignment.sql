-- Align Casual Labour RLS with the routes and service permissions.
-- HOD has manager-level operational visibility and approval capability.
drop policy if exists "labour vendors visible to field roles" on public.casual_labour_vendors;
create policy "labour vendors visible to field roles"
on public.casual_labour_vendors for select to authenticated
using (public.current_user_role() in ('site_staff', 'manager', 'hod', 'admin_hr', 'super_admin'));

drop policy if exists "labour workers visible to field roles" on public.casual_labour_workers;
create policy "labour workers visible to field roles"
on public.casual_labour_workers for select to authenticated
using (public.current_user_role() in ('site_staff', 'manager', 'hod', 'admin_hr', 'super_admin'));

drop policy if exists "labour workers created by field roles" on public.casual_labour_workers;
create policy "labour workers created by field roles"
on public.casual_labour_workers for insert to authenticated
with check (
  created_by = auth.uid()
  and public.current_user_role() in ('site_staff', 'manager', 'hod', 'admin_hr', 'super_admin')
);

drop policy if exists "labour attendance visible to owner manager or admin" on public.casual_labour_attendance;
create policy "labour attendance visible to owner manager or admin"
on public.casual_labour_attendance for select to authenticated
using (
  deleted_at is null
  and (
    submitted_by = auth.uid()
    or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "labour attendance created by field roles" on public.casual_labour_attendance;
create policy "labour attendance created by field roles"
on public.casual_labour_attendance for insert to authenticated
with check (
  submitted_by = auth.uid()
  and public.current_user_role() in ('site_staff', 'manager', 'hod', 'admin_hr', 'super_admin')
);

drop policy if exists "labour attendance updated by owner manager or admin" on public.casual_labour_attendance;
create policy "labour attendance updated by owner manager or admin"
on public.casual_labour_attendance for update to authenticated
using (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
)
with check (
  submitted_by = auth.uid()
  or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
);

drop policy if exists "labour rows visible with attendance" on public.casual_labour_attendance_rows;
create policy "labour rows visible with attendance"
on public.casual_labour_attendance_rows for select to authenticated
using (exists (
  select 1 from public.casual_labour_attendance attendance
  where attendance.id = attendance_id
    and attendance.deleted_at is null
    and (
      attendance.submitted_by = auth.uid()
      or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
    )
));

drop policy if exists "labour rows inserted with attendance" on public.casual_labour_attendance_rows;
create policy "labour rows inserted with attendance"
on public.casual_labour_attendance_rows for insert to authenticated
with check (exists (
  select 1 from public.casual_labour_attendance attendance
  where attendance.id = attendance_id
    and (
      attendance.submitted_by = auth.uid()
      or public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
    )
));

notify pgrst, 'reload schema';
