-- Leave: atomic staged decisions, integrity constraints, and realistic scenarios.

alter table public.leave_applications
  drop constraint if exists leave_dates_valid,
  drop constraint if exists leave_days_positive;
alter table public.leave_applications
  add constraint leave_dates_valid check (to_date >= from_date),
  add constraint leave_days_positive check (number_of_days > 0);

alter table public.leave_approval_history
  add column if not exists approval_sequence int,
  add column if not exists resulting_status public.leave_status;
create unique index if not exists uq_leave_history_stage_decision
  on public.leave_approval_history(leave_id, approval_sequence)
  where approval_sequence is not null and decision in ('approved', 'rejected');

create or replace function public.decide_leave_application(
  p_leave_id uuid,
  p_decision text,
  p_comments text
)
returns public.leave_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leave public.leave_applications;
  v_actor public.user_profiles;
  v_approved_count int;
  v_step_count int;
  v_step jsonb;
  v_expected_user uuid;
  v_expected_role text;
  v_final boolean;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  if nullif(trim(p_comments), '') is null then
    raise exception 'Decision comments are required';
  end if;

  select * into v_actor from public.user_profiles where id = auth.uid() and status = 'active';
  if v_actor.id is null then raise exception 'Active approver profile not found'; end if;

  select * into v_leave from public.leave_applications
  where id = p_leave_id and deleted_at is null for update;
  if v_leave.id is null then raise exception 'Leave application not found'; end if;
  if v_leave.status <> 'pending' then raise exception 'Only pending leave can be decided'; end if;
  if v_leave.user_id = auth.uid() then raise exception 'Users cannot approve their own leave'; end if;

  select count(*) into v_approved_count from public.leave_approval_history
  where leave_id = p_leave_id and decision = 'approved' and approval_sequence is not null;
  v_step_count := jsonb_array_length(v_leave.approval_path);
  if v_step_count = 0 then
    v_expected_user := v_leave.reporting_manager_id;
    v_expected_role := 'manager';
    v_step_count := 1;
  else
    v_step := v_leave.approval_path -> v_approved_count;
    v_expected_user := nullif(v_step ->> 'userId', '')::uuid;
    v_expected_role := v_step ->> 'role';
  end if;

  if v_expected_user is not null and v_expected_user <> auth.uid() then
    raise exception 'This approval stage is assigned to another user';
  end if;
  if v_expected_user is null and not (
    (v_expected_role = 'manager' and (v_actor.role_id = 'manager' or auth.uid() = v_leave.reporting_manager_id))
    or (v_expected_role = 'hod' and (v_actor.role_id = 'hod' or auth.uid() = v_leave.hod_user_id))
    or (v_expected_role = 'admin' and v_actor.role_id in ('admin_hr', 'super_admin'))
    or v_actor.role_id = 'super_admin'
  ) then
    raise exception 'Your role is not authorised for this approval stage';
  end if;

  v_final := p_decision = 'rejected' or v_approved_count + 1 >= v_step_count;
  update public.leave_applications set
    status = case when p_decision = 'rejected' then 'rejected'::public.leave_status
                  when v_final then 'approved'::public.leave_status else 'pending'::public.leave_status end,
    approved_by = case when v_final then auth.uid() else approved_by end,
    approval_date = case when v_final then now() else approval_date end,
    rejection_reason = case when p_decision = 'rejected' then p_comments else null end,
    comments = p_comments,
    updated_by = auth.uid()
  where id = p_leave_id returning * into v_leave;

  insert into public.leave_approval_history(
    leave_id, actor_id, actor_role, decision, comments, approval_sequence, resulting_status
  ) values (
    p_leave_id, auth.uid(), v_actor.role_id, p_decision, p_comments,
    v_approved_count + 1, v_leave.status
  );
  return v_leave;
end;
$$;

revoke all on function public.decide_leave_application(uuid, text, text) from public;
grant execute on function public.decide_leave_application(uuid, text, text) to authenticated;

-- Prevent direct status manipulation; application and workflow writes use RPCs.
drop policy if exists "leave updated by owner manager or admin" on public.leave_applications;
drop policy if exists "leave updated by workflow administrators" on public.leave_applications;
create policy "leave updated by workflow administrators"
on public.leave_applications for update to authenticated
using (organization_id = public.current_organization_id() and public.current_user_role() in ('admin_hr', 'super_admin'))
with check (organization_id = public.current_organization_id() and updated_by = auth.uid() and public.current_user_role() in ('admin_hr', 'super_admin'));

do $$
declare
  v_org uuid;
  v_hr uuid;
  v_user record;
  v_type uuid;
  v_number int := 1;
  v_id uuid;
  v_path jsonb;
  v_status public.leave_status;
begin
  select id, organization_id into v_hr, v_org from public.user_profiles
  where email = 'meera.nair@aureliainfra.in';
  if v_hr is null then return; end if;

  -- One approved casual-leave record per employee aligns with attendance on 26 June.
  select id into v_type from public.leave_types where code = 'CL';
  for v_user in
    select id, department_id, coalesce(reporting_manager_id, manager_id) manager_id, hod_user_id
    from public.user_profiles where organization_id = v_org and status = 'active' and deleted_at is null
    order by employee_code
  loop
    v_id := gen_random_uuid();
    v_path := jsonb_build_array(jsonb_build_object(
      'id', 'manager-' || v_user.id, 'sequence', 1, 'role', 'manager',
      'label', 'Reporting Manager', 'userId', v_user.manager_id,
      'source', 'default'
    ));
    insert into public.leave_applications(
      id, leave_number, user_id, organization_id, department_id, requester_user_id,
      manager_id, reporting_manager_id, hod_user_id, leave_type_id,
      from_date, to_date, number_of_days, reason, status, approval_path,
      approved_by, approval_date, comments, created_by, updated_by
    ) values (
      v_id, 'LV-2026-' || lpad(v_number::text, 4, '0'), v_user.id, v_org, v_user.department_id, v_user.id,
      v_user.manager_id, v_user.manager_id, v_user.hod_user_id, v_type,
      '2026-06-26', '2026-06-26', 1, 'Personal leave approved in advance.', 'approved', v_path,
      coalesce(v_user.manager_id, v_hr), '2026-06-24 10:00+05:30', 'Approved after workload handover.', v_user.id, coalesce(v_user.manager_id, v_hr)
    ) on conflict (leave_number) do nothing;
    insert into public.leave_approval_history(leave_id, actor_id, actor_role, decision, comments, approval_sequence, resulting_status)
    values (v_id, coalesce(v_user.manager_id, v_hr), 'manager', 'approved', 'Work coverage confirmed.', 1, 'approved')
    on conflict do nothing;
    v_number := v_number + 1;
  end loop;

  -- Additional status and multi-stage scenarios across real employees.
  for v_user in
    select id, department_id, coalesce(reporting_manager_id, manager_id) manager_id, hod_user_id,
      row_number() over(order by employee_code) rn
    from public.user_profiles where organization_id = v_org and status = 'active' and deleted_at is null
    order by employee_code limit 5
  loop
    v_id := gen_random_uuid();
    v_path := jsonb_build_array(
      jsonb_build_object('id','manager-'||v_user.id,'sequence',1,'role','manager','label','Reporting Manager','userId',v_user.manager_id,'source','default'),
      jsonb_build_object('id','hod-'||v_user.id,'sequence',2,'role','hod','label','Department HOD','userId',v_user.hod_user_id,'source','default')
    );
    v_status := case v_user.rn when 1 then 'pending' when 2 then 'pending' when 3 then 'approved' when 4 then 'rejected' else 'withdrawn' end;
    insert into public.leave_applications(
      id, leave_number, user_id, organization_id, department_id, requester_user_id,
      manager_id, reporting_manager_id, hod_user_id, leave_type_id,
      from_date, to_date, number_of_days, reason, status, approval_path,
      approved_by, approval_date, rejection_reason, comments, created_by, updated_by
    ) values (
      v_id, 'LV-2026-' || lpad(v_number::text, 4, '0'), v_user.id, v_org, v_user.department_id, v_user.id,
      v_user.manager_id, v_user.manager_id, v_user.hod_user_id, v_type,
      date '2026-08-03' + (v_user.rn::int * 7), date '2026-08-07' + (v_user.rn::int * 7), 5,
      case v_user.rn when 1 then 'Family function requiring planned travel.' when 2 then 'Outstation family commitment.' when 3 then 'Annual family vacation.' when 4 then 'Leave requested during critical project milestone.' else 'Travel plan cancelled by employee.' end,
      v_status, v_path,
      case when v_status in ('approved','rejected') then coalesce(v_user.hod_user_id, v_hr) end,
      case when v_status in ('approved','rejected') then now() end,
      case when v_status = 'rejected' then 'Critical milestone coverage unavailable.' end,
      case when v_status = 'withdrawn' then 'Employee withdrew after travel cancellation.' end,
      v_user.id, coalesce(v_user.manager_id, v_hr)
    );
    insert into public.leave_approval_history(leave_id, actor_id, actor_role, decision, comments)
    values (v_id, v_user.id, (select role_id from public.user_profiles where id=v_user.id), 'submitted', 'Submitted with handover plan.');
    if v_user.rn in (2,3,4) then
      insert into public.leave_approval_history(leave_id, actor_id, actor_role, decision, comments, approval_sequence, resulting_status)
      values (v_id, coalesce(v_user.manager_id,v_hr), 'manager', 'approved', 'Manager reviewed staffing coverage.', 1, 'pending');
    end if;
    if v_user.rn = 3 then
      insert into public.leave_approval_history(leave_id, actor_id, actor_role, decision, comments, approval_sequence, resulting_status)
      values (v_id, coalesce(v_user.hod_user_id,v_hr), 'hod', 'approved', 'HOD approved the planned absence.', 2, 'approved');
    elsif v_user.rn = 4 then
      insert into public.leave_approval_history(leave_id, actor_id, actor_role, decision, comments, approval_sequence, resulting_status)
      values (v_id, coalesce(v_user.hod_user_id,v_hr), 'hod', 'rejected', 'Critical milestone coverage unavailable.', 2, 'rejected');
    elsif v_user.rn = 5 then
      insert into public.leave_approval_history(leave_id, actor_id, actor_role, decision, comments)
      values (v_id, v_user.id, (select role_id from public.user_profiles where id=v_user.id), 'withdrawn', 'Travel plan cancelled.');
    end if;
    v_number := v_number + 1;
  end loop;

  if (select count(distinct status) from public.leave_applications where organization_id=v_org) < 4 then
    raise exception 'Leave status scenario validation failed';
  end if;
end $$;
