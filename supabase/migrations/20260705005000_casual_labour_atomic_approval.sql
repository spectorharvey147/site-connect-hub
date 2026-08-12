create or replace function public.approve_casual_labour_attendance(target_attendance_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  attendance public.casual_labour_attendance%rowtype;
  actor_id uuid := auth.uid();
  actor_role text := public.current_user_role();
  totals record;
begin
  if actor_id is null or actor_role not in ('manager', 'hod', 'admin_hr', 'super_admin') then
    raise exception 'Only an authorised approver can approve labour attendance';
  end if;

  select * into attendance
  from public.casual_labour_attendance
  where id = target_attendance_id
  for update;

  if not found then
    raise exception 'Labour attendance not found';
  end if;
  if attendance.status <> 'submitted' then
    raise exception 'Only submitted labour attendance can be approved';
  end if;

  select
    coalesce(sum(normal_amount), 0) normal_amount,
    coalesce(sum(overtime_amount), 0) overtime_amount,
    coalesce(sum(allowance), 0) allowance_amount,
    coalesce(sum(deduction), 0) deduction_amount,
    coalesce(sum(net_amount), 0) net_amount
  into totals
  from public.casual_labour_attendance_items
  where attendance_id = target_attendance_id;

  if not exists (
    select 1 from public.casual_labour_attendance_items
    where attendance_id = target_attendance_id
  ) then
    raise exception 'Attendance must contain at least one canonical labour item';
  end if;

  insert into public.casual_labour_bills (
    organization_id, project_id, department_id, vendor_id, contract_id,
    attendance_id, period_from, period_to, normal_amount, overtime_amount,
    allowance_amount, deduction_amount, net_amount, status, created_by
  ) values (
    attendance.organization_id, attendance.project_id, attendance.department_id,
    attendance.vendor_id, attendance.contract_id, attendance.id,
    attendance.date, attendance.date, totals.normal_amount,
    totals.overtime_amount, totals.allowance_amount, totals.deduction_amount,
    totals.net_amount, 'approved', actor_id
  )
  on conflict (attendance_id) do update set
    normal_amount = excluded.normal_amount,
    overtime_amount = excluded.overtime_amount,
    allowance_amount = excluded.allowance_amount,
    deduction_amount = excluded.deduction_amount,
    net_amount = excluded.net_amount,
    status = 'approved',
    updated_at = now();

  update public.casual_labour_attendance
  set status = 'approved', approved_by = actor_id, approved_at = now()
  where id = attendance.id;

  update public.casual_labour_attendance_items
  set status = 'approved', updated_by = actor_id, updated_at = now()
  where attendance_id = attendance.id;

  update public.casual_labour_work_allocations
  set status = 'approved', updated_at = now()
  where linked_attendance_ids @> array[attendance.id];

  return attendance.id;
end;
$$;

revoke all on function public.approve_casual_labour_attendance(uuid) from public;
grant execute on function public.approve_casual_labour_attendance(uuid) to authenticated;

notify pgrst, 'reload schema';
