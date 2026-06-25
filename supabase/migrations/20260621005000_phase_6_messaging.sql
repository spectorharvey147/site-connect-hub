do $$
begin
  create type public.conversation_type as enum (
    'direct',
    'group',
    'project'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.message_type as enum (
    'text',
    'image',
    'file'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null default 'direct',
  name text not null,
  description text,
  project_id uuid references public.projects(id),
  avatar_url text,
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  member_role text not null default 'member',
  joined_at timestamptz not null default now(),
  muted_until timestamptz,
  archived_at timestamptz,
  pinned_at timestamptz,
  last_read_at timestamptz,
  unique (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.user_profiles(id),
  content text not null default '',
  message_type public.message_type not null default 'text',
  replied_to_id uuid references public.messages(id),
  edited boolean not null default false,
  edited_at timestamptz,
  deleted_at timestamptz,
  sent_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_type text,
  file_size int,
  uploaded_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.message_read_receipts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, reaction)
);

create index if not exists idx_conversations_project_id on public.conversations(project_id);
create index if not exists idx_conversations_updated_at on public.conversations(updated_at);
create index if not exists idx_conversation_members_user_id on public.conversation_members(user_id);
create index if not exists idx_conversation_members_conversation_id on public.conversation_members(conversation_id);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_sender_id on public.messages(sender_id);
create index if not exists idx_messages_sent_at on public.messages(sent_at);
create index if not exists idx_message_attachments_message_id on public.message_attachments(message_id);
create index if not exists idx_message_read_receipts_message_id on public.message_read_receipts(message_id);
create index if not exists idx_message_read_receipts_user_id on public.message_read_receipts(user_id);
create index if not exists idx_message_reactions_message_id on public.message_reactions(message_id);

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

drop trigger if exists set_messages_updated_at on public.messages;
create trigger set_messages_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.message_read_receipts enable row level security;
alter table public.message_reactions enable row level security;

drop policy if exists "conversations visible to members or admins" on public.conversations;
create policy "conversations visible to members or admins"
on public.conversations for select
to authenticated
using (
  deleted_at is null
  and (
    public.current_user_role() in ('admin_hr', 'super_admin')
    or exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = conversations.id
        and cm.user_id = auth.uid()
    )
  )
);

drop policy if exists "authenticated users create conversations" on public.conversations;
create policy "authenticated users create conversations"
on public.conversations for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "conversation creators or admins update conversations" on public.conversations;
create policy "conversation creators or admins update conversations"
on public.conversations for update
to authenticated
using (
  created_by = auth.uid()
  or public.current_user_role() in ('admin_hr', 'super_admin')
  or exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
  )
)
with check (
  created_by = auth.uid()
  or public.current_user_role() in ('admin_hr', 'super_admin')
  or exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "conversation members visible to conversation users" on public.conversation_members;
create policy "conversation members visible to conversation users"
on public.conversation_members for select
to authenticated
using (
  public.current_user_role() in ('admin_hr', 'super_admin')
  or user_id = auth.uid()
  or exists (
    select 1
    from public.conversation_members own_member
    where own_member.conversation_id = conversation_members.conversation_id
      and own_member.user_id = auth.uid()
  )
);

drop policy if exists "conversation members inserted by creator or admin" on public.conversation_members;
create policy "conversation members inserted by creator or admin"
on public.conversation_members for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.current_user_role() in ('admin_hr', 'super_admin')
  or exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists "members update own conversation settings" on public.conversation_members;
create policy "members update own conversation settings"
on public.conversation_members for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "messages visible to conversation members" on public.messages;
create policy "messages visible to conversation members"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and c.deleted_at is null
      and (
        public.current_user_role() in ('admin_hr', 'super_admin')
        or exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "members insert messages" on public.messages;
create policy "members insert messages"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversation_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "senders update editable messages" on public.messages;
create policy "senders update editable messages"
on public.messages for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

drop policy if exists "message attachments visible with message" on public.message_attachments;
create policy "message attachments visible with message"
on public.message_attachments for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = message_id
      and cm.user_id = auth.uid()
  )
  or public.current_user_role() in ('admin_hr', 'super_admin')
);

drop policy if exists "message attachments inserted by sender" on public.message_attachments;
create policy "message attachments inserted by sender"
on public.message_attachments for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.messages m
    where m.id = message_id
      and m.sender_id = auth.uid()
  )
);

drop policy if exists "read receipts visible with message" on public.message_read_receipts;
create policy "read receipts visible with message"
on public.message_read_receipts for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = message_id
      and cm.user_id = auth.uid()
  )
  or public.current_user_role() in ('admin_hr', 'super_admin')
);

drop policy if exists "users insert own read receipts" on public.message_read_receipts;
create policy "users insert own read receipts"
on public.message_read_receipts for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = message_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "message reactions visible with message" on public.message_reactions;
create policy "message reactions visible with message"
on public.message_reactions for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = message_id
      and cm.user_id = auth.uid()
  )
  or public.current_user_role() in ('admin_hr', 'super_admin')
);

drop policy if exists "users manage own reactions" on public.message_reactions;
create policy "users manage own reactions"
on public.message_reactions for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = message_id
      and cm.user_id = auth.uid()
  )
);
