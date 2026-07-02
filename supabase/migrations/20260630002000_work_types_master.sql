create table if not exists public.work_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, name)
);

alter table public.work_types enable row level security;
create policy "work types visible to organization users" on public.work_types for select using (organization_id = public.current_organization_id());
create policy "work types managed by admins" on public.work_types for all using (organization_id = public.current_organization_id() and public.current_user_role() in ('admin_hr', 'super_admin')) with check (organization_id = public.current_organization_id() and public.current_user_role() in ('admin_hr', 'super_admin'));

insert into public.work_types (organization_id, code, name, description, status)
select organization.id, defaults.code, defaults.name, defaults.description, 'active'
from public.organizations organization
cross join (
  values
    ('IRRIGATION', 'Irrigation', 'Irrigation and water-management works'),
    ('CONSTRUCTION', 'Construction', 'Construction and civil works'),
    ('GROWING_MAINTENANCE', 'Growing & Maintenance', 'Growing, landscaping and maintenance works')
) as defaults(code, name, description)
on conflict (organization_id, code) do update
set name = excluded.name,
    description = excluded.description,
    status = 'active';
