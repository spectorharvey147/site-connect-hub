drop policy if exists "machine log sessions visible with log" on public.machine_log_sessions;
create policy "machine log sessions visible with log"
on public.machine_log_sessions for select to authenticated using (exists (
  select 1 from public.machine_logs log
  where log.id = machine_log_id and log.deleted_at is null
    and (log.submitted_by = auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin'))
));

drop policy if exists "machine log sessions inserted with log" on public.machine_log_sessions;
create policy "machine log sessions inserted with log"
on public.machine_log_sessions for insert to authenticated with check (exists (
  select 1 from public.machine_logs log
  where log.id = machine_log_id
    and (log.submitted_by = auth.uid() or public.current_user_role() in ('manager','hod','admin_hr','super_admin'))
));

drop policy if exists "machine_breakdowns_read" on public.machine_breakdowns;
create policy "machine_breakdowns_operational_read"
on public.machine_breakdowns for select to authenticated using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('site_staff','manager','hod','admin_hr','super_admin')
);

notify pgrst, 'reload schema';
