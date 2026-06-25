create table if not exists public.bootstrap_state (
  id boolean primary key default true check (id),
  status text not null check (status in ('running', 'complete')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  organization_id uuid references public.organizations(id) on delete set null,
  admin_user_id uuid references auth.users(id) on delete set null
);

alter table public.bootstrap_state enable row level security;
revoke all on public.bootstrap_state from anon, authenticated;

update public.projects
set latitude = 11.3410, longitude = 77.7172, geofence_radius = 500
where code = 'ERODE-SITE' and latitude is null;

update public.projects
set latitude = 11.6643, longitude = 78.1460, geofence_radius = 500
where code = 'SALEM-SITE' and latitude is null;

create or replace function public.has_initial_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where role_id in ('admin_hr', 'super_admin')
      and status = 'active'
      and deleted_at is null
  )
  or exists (
    select 1
    from public.bootstrap_state
    where id = true and status in ('running', 'complete')
  );
$$;

revoke all on function public.has_initial_admin() from public;
grant execute on function public.has_initial_admin() to anon, authenticated;

drop policy if exists "organization members read storage objects" on storage.objects;
create policy "organization members read storage objects"
on storage.objects for select
to authenticated
using (
  bucket_id in (
    'organization-logos',
    'profile-photos',
    'claim-attachments',
    'leave-documents',
    'dpr-photos',
    'task-attachments',
    'message-attachments',
    'vendor-bills',
    'material-documents',
    'fuel-receipts'
  )
  and (
    (storage.foldername(name))[1] = public.current_organization_id()::text
    or public.current_user_role() = 'super_admin'
  )
);

drop policy if exists "organization members upload storage objects" on storage.objects;
create policy "organization members upload storage objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id in (
    'organization-logos',
    'profile-photos',
    'claim-attachments',
    'leave-documents',
    'dpr-photos',
    'task-attachments',
    'message-attachments',
    'vendor-bills',
    'material-documents',
    'fuel-receipts'
  )
  and (storage.foldername(name))[1] = public.current_organization_id()::text
);

drop policy if exists "owners and admins update storage objects" on storage.objects;
create policy "owners and admins update storage objects"
on storage.objects for update
to authenticated
using (
  owner_id = auth.uid()::text
  or public.current_user_role() in ('admin_hr', 'super_admin')
)
with check (
  (storage.foldername(name))[1] = public.current_organization_id()::text
  or public.current_user_role() = 'super_admin'
);

drop policy if exists "owners and admins delete storage objects" on storage.objects;
create policy "owners and admins delete storage objects"
on storage.objects for delete
to authenticated
using (
  owner_id = auth.uid()::text
  or public.current_user_role() in ('admin_hr', 'super_admin')
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
