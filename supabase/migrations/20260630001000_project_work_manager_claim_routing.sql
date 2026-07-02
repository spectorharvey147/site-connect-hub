alter table public.projects
  add column if not exists work_manager_mappings jsonb not null default '[]'::jsonb;

alter table public.claims
  add column if not exists work_type text;

comment on column public.projects.work_manager_mappings is
  'Project-specific work type to manager mappings used for claim routing.';
