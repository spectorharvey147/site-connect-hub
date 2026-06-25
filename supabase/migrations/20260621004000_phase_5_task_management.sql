do $$
begin
  create type public.task_status as enum (
    'not_started',
    'in_progress',
    'completed',
    'on_hold',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.task_priority as enum (
    'high',
    'medium',
    'low'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_number text not null unique,
  title text not null,
  description text not null,
  project_id uuid not null references public.projects(id),
  created_by uuid not null references public.user_profiles(id),
  assigned_to uuid not null references public.user_profiles(id),
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'not_started',
  due_date date not null,
  due_time time,
  estimated_hours numeric(8, 2) not null default 0,
  progress_percent int not null default 0 check (progress_percent between 0 and 100),
  reminder_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id),
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text,
  file_size int,
  uploaded_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid not null references public.user_profiles(id),
  actor_role text not null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_created_by on public.tasks(created_by);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_tasks_priority on public.tasks(priority);
create index if not exists idx_task_comments_task_id on public.task_comments(task_id);
create index if not exists idx_task_attachments_task_id on public.task_attachments(task_id);
create index if not exists idx_task_activity_task_id on public.task_activity(task_id);

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_task_comments_updated_at on public.task_comments;
create trigger set_task_comments_updated_at
before update on public.task_comments
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_activity enable row level security;

drop policy if exists "tasks visible by owner assignee manager or admin" on public.tasks;
create policy "tasks visible by owner assignee manager or admin"
on public.tasks for select
to authenticated
using (
  deleted_at is null
  and (
    assigned_to = auth.uid()
    or created_by = auth.uid()
    or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "tasks created by manager or admin roles" on public.tasks;
create policy "tasks created by manager or admin roles"
on public.tasks for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
);

drop policy if exists "tasks updated by participants or admin roles" on public.tasks;
create policy "tasks updated by participants or admin roles"
on public.tasks for update
to authenticated
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
)
with check (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
);

drop policy if exists "task comments visible with task" on public.task_comments;
create policy "task comments visible with task"
on public.task_comments for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.deleted_at is null
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "task comments inserted by visible users" on public.task_comments;
create policy "task comments inserted by visible users"
on public.task_comments for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.deleted_at is null
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "task attachments visible with task" on public.task_attachments;
create policy "task attachments visible with task"
on public.task_attachments for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.deleted_at is null
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "task attachments inserted by visible users" on public.task_attachments;
create policy "task attachments inserted by visible users"
on public.task_attachments for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.deleted_at is null
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "task activity visible with task" on public.task_activity;
create policy "task activity visible with task"
on public.task_activity for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.deleted_at is null
      and (
        t.assigned_to = auth.uid()
        or t.created_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "task activity inserted by actor" on public.task_activity;
create policy "task activity inserted by actor"
on public.task_activity for insert
to authenticated
with check (actor_id = auth.uid());
