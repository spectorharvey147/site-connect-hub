create table if not exists public.business_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module text not null,
  entity_type text not null,
  record_id text not null,
  project_id uuid references public.projects(id) on delete set null,
  owner_user_id uuid references public.user_profiles(id) on delete set null,
  status text,
  document_date date,
  data jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module, entity_type, record_id)
);

create index if not exists idx_business_documents_scope
  on public.business_documents(organization_id, module, entity_type);
create index if not exists idx_business_documents_project
  on public.business_documents(project_id, document_date desc);
create index if not exists idx_business_documents_owner
  on public.business_documents(owner_user_id, document_date desc);
create index if not exists idx_business_documents_status
  on public.business_documents(module, entity_type, status);

drop trigger if exists set_business_documents_updated_at
on public.business_documents;
create trigger set_business_documents_updated_at
before update on public.business_documents
for each row execute function public.set_updated_at();

alter table public.business_documents enable row level security;

drop policy if exists "organization members read business documents"
on public.business_documents;
create policy "organization members read business documents"
on public.business_documents for select
to authenticated
using (
  organization_id = public.current_organization_id()
  or public.current_user_role() = 'super_admin'
);

drop policy if exists "organization members create business documents"
on public.business_documents;
create policy "organization members create business documents"
on public.business_documents for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    organization_id = public.current_organization_id()
    or public.current_user_role() = 'super_admin'
  )
);

drop policy if exists "organization members update business documents"
on public.business_documents;
create policy "organization members update business documents"
on public.business_documents for update
to authenticated
using (
  owner_user_id = auth.uid()
  or public.current_user_role() in (
    'manager',
    'hod',
    'admin_hr',
    'super_admin',
    'accounts_officer'
  )
)
with check (
  organization_id = public.current_organization_id()
  or public.current_user_role() = 'super_admin'
);

drop policy if exists "admins delete business documents"
on public.business_documents;
create policy "admins delete business documents"
on public.business_documents for delete
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'));

create table if not exists public.offline_mutations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  client_mutation_id text not null,
  mutation_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, client_mutation_id)
);

alter table public.offline_mutations enable row level security;
create policy "users manage own offline mutations"
on public.offline_mutations for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and organization_id = public.current_organization_id()
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'business_documents'
  ) then
    alter publication supabase_realtime add table public.business_documents;
  end if;
end;
$$;

alter table public.user_invitations
  add column if not exists phone text,
  add column if not exists employment_type text,
  add column if not exists joining_date date,
  add column if not exists project_ids uuid[] not null default '{}',
  add column if not exists auth_user_id uuid references auth.users(id);

create or replace function public.attendance_punch(
  p_action text,
  p_project_id uuid default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy int default null
)
returns public.attendance
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_record public.attendance;
  v_profile public.user_profiles;
  v_shift_id uuid;
  v_server_time time := localtime;
begin
  if p_action not in ('check_in', 'check_out') then
    raise exception 'Unsupported attendance action';
  end if;

  select * into v_profile from public.user_profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'User profile not found';
  end if;

  select id into v_shift_id
  from public.shifts
  where status = 'active'
  order by start_time
  limit 1;

  select * into v_record
  from public.attendance
  where user_id = auth.uid() and date = current_date
  for update;

  if p_action = 'check_in' then
    if v_record.check_in_time is not null then
      raise exception 'Attendance already checked in for today';
    end if;
    insert into public.attendance (
      user_id, organization_id, department_id, project_id,
      reporting_manager_id, hod_user_id, shift_id, date,
      check_in_time, status, worked_hours,
      location_lat, location_lon, location_accuracy,
      created_by, updated_by
    ) values (
      auth.uid(), v_profile.organization_id, v_profile.department_id, p_project_id,
      coalesce(v_profile.reporting_manager_id, v_profile.manager_id),
      v_profile.hod_user_id, v_shift_id, current_date,
      v_server_time, 'present', 0,
      p_latitude, p_longitude, p_accuracy,
      auth.uid(), auth.uid()
    )
    returning * into v_record;
  else
    if v_record.id is null or v_record.check_in_time is null then
      raise exception 'Check in before checking out';
    end if;
    if v_record.check_out_time is not null then
      raise exception 'Attendance already checked out for today';
    end if;
    update public.attendance
    set
      check_out_time = v_server_time,
      worked_hours = greatest(
        extract(epoch from (v_server_time - check_in_time)) / 3600,
        0
      ),
      checkout_location_lat = p_latitude,
      checkout_location_lon = p_longitude,
      checkout_location_accuracy = p_accuracy,
      updated_by = auth.uid()
    where id = v_record.id
    returning * into v_record;
  end if;

  return v_record;
end;
$$;

grant execute on function public.attendance_punch(text, uuid, numeric, numeric, int)
to authenticated;
