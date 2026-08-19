-- Forward-only hardening for the existing master attendance model.
alter table public.shifts add column if not exists organization_id uuid references public.organizations(id);
alter table public.organizations add column if not exists default_shift_id uuid references public.shifts(id);
alter table public.projects
  add column if not exists attendance_enabled boolean not null default false,
  add column if not exists attendance_configuration_verified boolean not null default false,
  add column if not exists attendance_verified_by uuid references public.user_profiles(id),
  add column if not exists attendance_verified_at timestamptz,
  add column if not exists default_shift_id uuid references public.shifts(id);

create table if not exists public.employee_shift_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  shift_id uuid not null references public.shifts(id),
  effective_from date not null,
  effective_to date,
  active boolean not null default true,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create table if not exists public.project_shift_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  shift_id uuid not null references public.shifts(id),
  effective_from date not null,
  effective_to date,
  active boolean not null default true,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create unique index if not exists employee_shift_effective_uidx on public.employee_shift_assignments(user_id,effective_from) where active;
create unique index if not exists project_shift_effective_uidx on public.project_shift_assignments(project_id,effective_from) where active;

alter table public.attendance
  add column if not exists check_in_at timestamptz,
  add column if not exists check_out_at timestamptz,
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_by uuid references public.user_profiles(id),
  add column if not exists locked_at timestamptz,
  add column if not exists lock_reason text,
  add column if not exists corrected_by uuid references public.user_profiles(id),
  add column if not exists correction_reason text,
  add column if not exists correction_requested_by uuid references public.user_profiles(id),
  add column if not exists correction_requested_at timestamptz;

update public.attendance
set check_in_at = date::timestamp + check_in_time,
    check_out_at = case when check_out_time is null then null
      when check_out_time < check_in_time then date::timestamp + interval '1 day' + check_out_time
      else date::timestamp + check_out_time end
where check_in_time is not null and check_in_at is null;

create or replace view public.project_attendance_readiness as
select p.id as project_id, p.organization_id,
  (p.status='active' and p.deleted_at is null and p.attendance_enabled
   and p.attendance_configuration_verified and p.latitude between -90 and 90
   and p.longitude between -180 and 180 and p.geofence_radius between 10 and 5000) as is_ready,
  array_remove(array[
    case when p.status<>'active' or p.deleted_at is not null then 'project_inactive' end,
    case when not p.attendance_enabled then 'attendance_disabled' end,
    case when p.latitude is null or p.latitude not between -90 and 90 then 'invalid_latitude' end,
    case when p.longitude is null or p.longitude not between -180 and 180 then 'invalid_longitude' end,
    case when p.geofence_radius is null or p.geofence_radius not between 10 and 5000 then 'invalid_radius' end,
    case when not p.attendance_configuration_verified then 'not_verified' end
  ],null) as readiness_issues
from public.projects p;

create or replace function public.resolve_effective_shift(p_user_id uuid,p_project_id uuid,p_date date)
returns uuid language sql stable security definer set search_path=public as $$
  select coalesce(
    (select shift_id from employee_shift_assignments where user_id=p_user_id and active and effective_from<=p_date and (effective_to is null or effective_to>=p_date) order by effective_from desc limit 1),
    (select shift_id from project_shift_assignments where project_id=p_project_id and active and effective_from<=p_date and (effective_to is null or effective_to>=p_date) order by effective_from desc limit 1),
    (select default_shift_id from projects where id=p_project_id),
    (select o.default_shift_id from organizations o join user_profiles u on u.organization_id=o.id where u.id=p_user_id),
    (select id from shifts where status='active' order by case when name='General Shift' then 0 else 1 end,start_time,id limit 1)
  );
$$;

create or replace function public.guard_locked_attendance()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.is_locked and (
    new.check_in_at is distinct from old.check_in_at or new.check_out_at is distinct from old.check_out_at or
    new.check_in_time is distinct from old.check_in_time or new.check_out_time is distinct from old.check_out_time or
    new.status is distinct from old.status or new.worked_hours is distinct from old.worked_hours
  ) then
    if public.current_user_role() not in ('admin_hr','super_admin','manager','hod') or nullif(trim(new.correction_reason),'') is null then
      raise exception 'Locked attendance requires an authorised correction with a reason';
    end if;
    if public.current_user_role()='manager' and old.reporting_manager_id is distinct from auth.uid() then raise exception 'Manager scope denied'; end if;
    if public.current_user_role()='hod' and old.hod_user_id is distinct from auth.uid() then raise exception 'HOD scope denied'; end if;
    new.corrected_by:=auth.uid();
  end if;
  return new;
end$$;
drop trigger if exists guard_locked_attendance on public.attendance;
create trigger guard_locked_attendance before update on public.attendance for each row execute function public.guard_locked_attendance();

create or replace function public.attendance_punch(
  p_action text,
  p_project_id uuid default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy int default null
)
returns public.attendance language plpgsql security definer set search_path=public as $$
declare v_record public.attendance; v_profile public.user_profiles; v_project public.projects; v_shift uuid;
  v_now timestamptz:=clock_timestamp(); v_work_date date:=current_date; v_distance numeric; v_hours numeric;
begin
  if p_action not in ('check_in','check_out') then raise exception 'Unsupported attendance action'; end if;
  select * into v_profile from user_profiles where id=auth.uid() and status='active';
  if not found then raise exception 'Active user profile not found'; end if;
  if p_action='check_out' then
    select * into v_record from attendance where user_id=auth.uid() and check_in_at is not null and check_out_at is null and date>=current_date-1 order by check_in_at desc limit 1 for update;
    if not found then raise exception 'Check in before checking out'; end if;
    v_work_date:=v_record.date; p_project_id:=v_record.project_id;
  else
    select * into v_record from attendance where user_id=auth.uid() and date=current_date for update;
    if found and v_record.check_in_at is not null then raise exception 'Attendance already checked in for today'; end if;
  end if;
  if p_project_id is null then raise exception 'A project is required for attendance'; end if;
  if not exists(select 1 from user_project_assignments a where a.user_id=auth.uid() and a.project_id=p_project_id and a.status='active' and a.start_date<=v_work_date and (a.end_date is null or a.end_date>=v_work_date)) then raise exception 'You are not actively assigned to this project'; end if;
  select p.* into v_project from projects p join project_attendance_readiness r on r.project_id=p.id and r.is_ready where p.id=p_project_id and p.organization_id=v_profile.organization_id;
  if not found then raise exception 'Project attendance/geofence is not ready'; end if;
  if p_latitude is null or p_longitude is null then raise exception 'GPS coordinates are required'; end if;
  if p_accuracy is null or p_accuracy<=0 or p_accuracy>100 then raise exception 'GPS accuracy must be 100 metres or better'; end if;
  v_distance:=6371000*2*asin(sqrt(power(sin(radians((p_latitude-v_project.latitude)/2)),2)+cos(radians(v_project.latitude))*cos(radians(p_latitude))*power(sin(radians((p_longitude-v_project.longitude)/2)),2)));
  if v_distance>v_project.geofence_radius then raise exception 'Outside project geofence: % metres from site',round(v_distance); end if;
  if p_action='check_in' then
    v_shift:=resolve_effective_shift(auth.uid(),p_project_id,v_work_date);
    if v_shift is null then raise exception 'No effective shift is configured'; end if;
    insert into attendance(user_id,organization_id,department_id,project_id,reporting_manager_id,hod_user_id,shift_id,date,check_in_at,check_in_time,status,worked_hours,location_lat,location_lon,location_accuracy,created_by,updated_by)
    values(auth.uid(),v_profile.organization_id,v_profile.department_id,p_project_id,coalesce(v_profile.reporting_manager_id,v_profile.manager_id),v_profile.hod_user_id,v_shift,v_work_date,v_now,v_now::time,'present',0,p_latitude,p_longitude,p_accuracy,auth.uid(),auth.uid()) returning * into v_record;
  else
    if v_record.check_out_at is not null then raise exception 'Attendance already checked out'; end if;
    v_hours:=extract(epoch from(v_now-v_record.check_in_at))/3600;
    if v_hours<0 or v_hours>20 then raise exception 'Worked duration is outside the allowed shift window'; end if;
    update attendance set check_out_at=v_now,check_out_time=v_now::time,worked_hours=round(v_hours::numeric,2),checkout_location_lat=p_latitude,checkout_location_lon=p_longitude,checkout_location_accuracy=p_accuracy,is_locked=true,locked_by=auth.uid(),locked_at=v_now,lock_reason='Automatically locked on check-out',updated_by=auth.uid() where id=v_record.id returning * into v_record;
  end if;
  return v_record;
end$$;
revoke all on function public.attendance_punch(text,uuid,numeric,numeric,int) from public;
grant execute on function public.attendance_punch(text,uuid,numeric,numeric,int) to authenticated;

create or replace function public.attendance_punch(p_action text,p_project_id uuid,p_latitude numeric,p_longitude numeric,p_accuracy int,p_selfie_path text,p_captured_at timestamptz,p_client_mutation_id text)
returns public.attendance language plpgsql security definer set search_path=public as $$
declare v_record attendance;
begin
  if nullif(trim(p_client_mutation_id),'') is null then raise exception 'Client mutation ID is required'; end if;
  select * into v_record from attendance where user_id=auth.uid() and (check_in_client_mutation_id=p_client_mutation_id or check_out_client_mutation_id=p_client_mutation_id);
  if found then return v_record; end if;
  if nullif(trim(p_selfie_path),'') is null then raise exception 'Attendance selfie is required'; end if;
  if p_captured_at is null or p_captured_at>now()+interval '5 minutes' or p_captured_at<now()-interval '24 hours' then raise exception 'Attendance capture time is invalid or expired'; end if;
  v_record:=public.attendance_punch(p_action,p_project_id,p_latitude,p_longitude,p_accuracy);
  if p_action='check_in' then update attendance set check_in_selfie_path=p_selfie_path,check_in_captured_at=p_captured_at,check_in_client_mutation_id=p_client_mutation_id where id=v_record.id returning * into v_record;
  else update attendance set check_out_selfie_path=p_selfie_path,check_out_captured_at=p_captured_at,check_out_client_mutation_id=p_client_mutation_id where id=v_record.id returning * into v_record; end if;
  return v_record;
end$$;
revoke all on function public.attendance_punch(text,uuid,numeric,numeric,int,text,timestamptz,text) from public;
grant execute on function public.attendance_punch(text,uuid,numeric,numeric,int,text,timestamptz,text) to authenticated;

drop policy if exists "attendance visible by owner or role" on public.attendance;
create policy "attendance hierarchy scoped visibility" on public.attendance for select to authenticated using (
  organization_id=public.current_organization_id() and deleted_at is null and (
    user_id=auth.uid() or public.current_user_role() in ('admin_hr','super_admin') or
    (public.current_user_role()='manager' and reporting_manager_id=auth.uid()) or
    (public.current_user_role()='hod' and hod_user_id=auth.uid())
  )
);
alter table public.employee_shift_assignments enable row level security;
alter table public.project_shift_assignments enable row level security;
create policy "shift assignments organization scoped" on public.employee_shift_assignments for all to authenticated using(organization_id=public.current_organization_id() and public.current_user_role() in ('admin_hr','super_admin')) with check(organization_id=public.current_organization_id() and public.current_user_role() in ('admin_hr','super_admin'));
create policy "project shifts organization scoped" on public.project_shift_assignments for all to authenticated using(organization_id=public.current_organization_id() and public.current_user_role() in ('admin_hr','super_admin')) with check(organization_id=public.current_organization_id() and public.current_user_role() in ('admin_hr','super_admin'));
