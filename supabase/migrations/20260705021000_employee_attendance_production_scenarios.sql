-- Employee attendance: enforce workflow boundaries and seed production scenarios.

alter table public.attendance
  drop constraint if exists attendance_checkout_requires_checkin,
  drop constraint if exists attendance_nonnegative_hours;

alter table public.attendance
  add constraint attendance_checkout_requires_checkin
    check (check_out_time is null or check_in_time is not null),
  add constraint attendance_nonnegative_hours
    check (worked_hours >= 0 and worked_hours <= 24);

-- Punches run through the validated RPC. Direct row writes are reserved for
-- authorised manual-attendance actors.
alter function public.attendance_punch(text, uuid, numeric, numeric, int)
  security definer;

revoke all on function public.attendance_punch(text, uuid, numeric, numeric, int) from public;
grant execute on function public.attendance_punch(text, uuid, numeric, numeric, int) to authenticated;

drop policy if exists "users create own attendance" on public.attendance;
drop policy if exists "attendance updated by owner or admin roles" on public.attendance;
drop policy if exists "attendance inserted by authorised manual actors" on public.attendance;
create policy "attendance inserted by authorised manual actors"
on public.attendance for insert to authenticated
with check (
  organization_id = public.current_organization_id()
  and created_by = auth.uid()
  and (
    public.current_user_role() in ('admin_hr', 'super_admin')
    or (public.current_user_role() = 'manager' and reporting_manager_id = auth.uid())
    or (
      public.current_user_role() = 'hod'
      and hod_user_id = auth.uid()
      and department_id in (
        select department_id from public.user_profiles where id = auth.uid()
      )
    )
  )
);

drop policy if exists "attendance updated by authorised manual actors" on public.attendance;
create policy "attendance updated by authorised manual actors"
on public.attendance for update to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.current_user_role() in ('admin_hr', 'super_admin')
    or (public.current_user_role() = 'manager' and reporting_manager_id = auth.uid())
    or (
      public.current_user_role() = 'hod'
      and hod_user_id = auth.uid()
      and department_id in (
        select department_id from public.user_profiles where id = auth.uid()
      )
    )
  )
)
with check (
  organization_id = public.current_organization_id()
  and updated_by = auth.uid()
  and (
    public.current_user_role() in ('admin_hr', 'super_admin')
    or (public.current_user_role() = 'manager' and reporting_manager_id = auth.uid())
    or (
      public.current_user_role() = 'hod'
      and hod_user_id = auth.uid()
      and department_id in (
        select department_id from public.user_profiles where id = auth.uid()
      )
    )
  )
);

create index if not exists idx_attendance_active_user_date
  on public.attendance(user_id, date desc) where deleted_at is null;

-- Keep database shift names/times aligned with the application shift catalogue.
update public.shifts set name = 'Early Site Shift', grace_minutes = 10
where name = 'Site Day Shift';
update public.shifts set name = 'Night Shift', start_time = '20:00', end_time = '05:00'
where name = 'Site Night Shift';

do $$
declare
  v_org uuid;
  v_hr uuid;
  v_user record;
  v_day date;
  v_index int;
  v_status public.attendance_status;
  v_check_in time;
  v_check_out time;
  v_hours numeric;
  v_project uuid;
  v_shift uuid;
begin
  select id, organization_id into v_hr, v_org
  from public.user_profiles
  where email = 'meera.nair@aureliainfra.in';

  if v_hr is null then
    raise exception 'Attendance seed prerequisite missing: HR profile';
  end if;

  for v_user in
    select p.id, p.organization_id, p.department_id,
      coalesce(p.reporting_manager_id, p.manager_id) as reporting_manager_id,
      p.hod_user_id, p.primary_project_id, p.role_id
    from public.user_profiles p
    where p.organization_id = v_org and p.status = 'active' and p.deleted_at is null
    order by p.employee_code
  loop
    v_project := coalesce(
      v_user.primary_project_id,
      (select project_id from public.user_project_assignments
       where user_id = v_user.id and status = 'active' order by start_date limit 1),
      '50000000-0000-4000-8000-000000000003'::uuid
    );
    select id into v_shift from public.shifts
    where name = case when v_user.role_id = 'site_staff' then 'Early Site Shift' else 'General Shift' end
      and status = 'active'
    limit 1;
    if v_shift is null then
      raise exception 'Attendance seed prerequisite missing: active shift';
    end if;

    for v_index in 0..8 loop
      v_day := date '2026-06-22' + v_index;
      if extract(isodow from v_day) = 7 then
        v_status := 'week_off_present'; v_check_in := '07:05'; v_check_out := '13:05'; v_hours := 6;
      elsif v_index = 1 then
        v_status := 'late'; v_check_in := '09:32'; v_check_out := '18:05'; v_hours := 8.55;
      elsif v_index = 2 then
        v_status := 'half_day'; v_check_in := '09:04'; v_check_out := '13:08'; v_hours := 4.07;
      elsif v_index = 3 then
        v_status := 'absent'; v_check_in := null; v_check_out := null; v_hours := 0;
      elsif v_index = 4 then
        v_status := 'on_leave'; v_check_in := null; v_check_out := null; v_hours := 0;
      elsif v_index = 5 and v_user.role_id = 'site_staff' then
        v_status := 'missed_correction'; v_check_in := '07:02'; v_check_out := null; v_hours := 0;
      else
        v_status := 'present';
        v_check_in := case when v_user.role_id = 'site_staff' then '06:56' else '08:56' end;
        v_check_out := case when v_user.role_id = 'site_staff' then '16:08' else '18:07' end;
        v_hours := case when v_user.role_id = 'site_staff' then 9.2 else 9.18 end;
      end if;

      insert into public.attendance (
        id, user_id, organization_id, department_id, project_id,
        reporting_manager_id, hod_user_id, shift_id, date,
        check_in_time, check_out_time, status, worked_hours, remarks,
        approved_by, created_by, updated_by
      ) values (
        gen_random_uuid(), v_user.id, v_user.organization_id, v_user.department_id, v_project,
        v_user.reporting_manager_id, v_user.hod_user_id, v_shift, v_day,
        v_check_in, v_check_out, v_status, v_hours,
        case v_status
          when 'late' then 'Late arrival due to city traffic; manager informed.'
          when 'half_day' then 'Approved half-day for personal appointment.'
          when 'absent' then 'Unplanned absence recorded by HR.'
          when 'on_leave' then 'Linked to approved leave scenario.'
          when 'missed_correction' then 'Check-out missing; correction required.'
          when 'week_off_present' then 'Emergency site activity on weekly off.'
          else 'Regular scheduled attendance.' end,
        v_hr, v_hr, v_hr
      )
      on conflict (user_id, date) do update set
        organization_id = excluded.organization_id,
        department_id = excluded.department_id,
        project_id = excluded.project_id,
        reporting_manager_id = excluded.reporting_manager_id,
        hod_user_id = excluded.hod_user_id,
        shift_id = excluded.shift_id,
        check_in_time = excluded.check_in_time,
        check_out_time = excluded.check_out_time,
        status = excluded.status,
        worked_hours = excluded.worked_hours,
        remarks = excluded.remarks,
        approved_by = excluded.approved_by,
        updated_by = excluded.updated_by;
    end loop;
  end loop;

  if not exists (select 1 from public.attendance where organization_id = v_org and status = 'late')
     or not exists (select 1 from public.attendance where organization_id = v_org and status = 'half_day')
     or not exists (select 1 from public.attendance where organization_id = v_org and status = 'missed_correction') then
    raise exception 'Attendance scenario coverage validation failed';
  end if;
end $$;
