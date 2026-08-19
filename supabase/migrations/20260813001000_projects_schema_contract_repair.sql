-- Keep the project creation contract intact on environments that missed one of
-- the incremental project migrations, then force PostgREST to refresh its cache.
alter table public.projects
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists customer_id uuid references public.customers(id),
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists pincode text,
  add column if not exists latitude numeric(10, 7),
  add column if not exists longitude numeric(10, 7),
  add column if not exists geofence_radius numeric(10, 2) not null default 250,
  add column if not exists attendance_enabled boolean not null default false,
  add column if not exists attendance_configuration_verified boolean not null default false,
  add column if not exists attendance_verified_by uuid references public.user_profiles(id),
  add column if not exists attendance_verified_at timestamptz,
  add column if not exists default_shift_id uuid references public.shifts(id),
  add column if not exists project_budget numeric(14, 2) not null default 0,
  add column if not exists project_manager_id uuid references public.user_profiles(id),
  add column if not exists work_manager_mappings jsonb not null default '[]'::jsonb,
  add column if not exists primary_department_id uuid references public.departments(id),
  add column if not exists is_common_project boolean not null default false,
  add column if not exists description text;

do $$
declare
  missing_columns text[];
begin
  select array_agg(required.column_name order by required.column_name)
  into missing_columns
  from unnest(array[
    'organization_id', 'code', 'name', 'customer_id', 'customer_name',
    'location', 'address', 'city', 'state', 'pincode', 'latitude',
    'longitude', 'geofence_radius', 'attendance_enabled',
    'attendance_configuration_verified', 'attendance_verified_by',
    'attendance_verified_at', 'start_date', 'end_date', 'project_budget',
    'project_manager_id', 'work_manager_mappings', 'primary_department_id',
    'is_common_project', 'description', 'status', 'created_by', 'updated_by'
  ]) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns actual
    where actual.table_schema = 'public'
      and actual.table_name = 'projects'
      and actual.column_name = required.column_name
  );

  if missing_columns is not null then
    raise exception 'projects schema contract is incomplete; missing columns: %',
      array_to_string(missing_columns, ', ');
  end if;
end
$$;

select pg_notify('pgrst', 'reload schema');
