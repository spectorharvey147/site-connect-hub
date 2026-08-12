-- Database-level workflow guards: UI/service checks must not be bypassable via REST.
create or replace function public.guard_casual_labour_attendance_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare actor_role text;
begin
  -- Migrations and trusted server maintenance run without an end-user JWT.
  if auth.uid() is null then
    return new;
  end if;

  actor_role := public.current_user_role();

  if old.status = 'approved' and new.status is distinct from old.status then
    raise exception 'Approved labour attendance cannot be reopened';
  end if;

  if new.status = 'approved' and old.status <> 'submitted' then
    raise exception 'Only submitted labour attendance can be approved';
  end if;

  if new.status = 'approved'
     and actor_role not in ('manager', 'hod', 'admin_hr', 'super_admin') then
    raise exception 'Only an authorised approver can approve labour attendance';
  end if;

  if new.approved_by is distinct from old.approved_by
     and new.approved_by is distinct from auth.uid() then
    raise exception 'approved_by must match the authenticated approver';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_casual_labour_attendance_transition
on public.casual_labour_attendance;
create trigger guard_casual_labour_attendance_transition
before update on public.casual_labour_attendance
for each row execute function public.guard_casual_labour_attendance_transition();

drop policy if exists "casual_labour_bills_organization_insert" on public.casual_labour_bills;
create policy "casual_labour_bills_approver_insert"
on public.casual_labour_bills for insert to authenticated
with check (
  organization_id = public.current_organization_id()
  and created_by = auth.uid()
  and public.current_user_role() in ('manager', 'hod', 'admin_hr', 'super_admin')
);

drop policy if exists "labour_advance_deductions_insert" on public.labour_advance_deductions;
create policy "labour_advance_deductions_finance_insert"
on public.labour_advance_deductions for insert to authenticated
with check (
  organization_id = public.current_organization_id()
  and created_by = auth.uid()
  and public.current_user_role() in ('manager', 'hod', 'accounts_officer', 'admin_hr', 'super_admin')
);

notify pgrst, 'reload schema';
