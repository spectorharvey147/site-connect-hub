-- Independent Communication Center. Attendance events are intentionally absent.
create table if not exists public.communication_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  globally_enabled boolean not null default false,
  approval_required boolean not null default true,
  min_interval_seconds int not null default 10 check(min_interval_seconds>=10),
  max_per_minute int not null default 3 check(max_per_minute between 1 and 60),
  max_per_hour int not null default 30 check(max_per_hour between 1 and 1000),
  max_per_group_hour int not null default 10 check(max_per_group_hour between 1 and 1000),
  consecutive_failures_before_pause int not null default 3 check(consecutive_failures_before_pause between 1 and 20),
  reconnect_cooldown_seconds int not null default 600 check(reconnect_cooldown_seconds>=60),
  paused_at timestamptz, pause_reason text, updated_by uuid references public.user_profiles(id), updated_at timestamptz not null default now()
);
create table if not exists public.communication_gateways (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check(channel='whatsapp'), provider text not null, display_name text not null,
  status text not null default 'disconnected' check(status in('starting','pairing','connecting','connected','disconnected','paused','restricted','logged_out','auth_failed')),
  linked_number text, last_seen_at timestamptz, last_connected_at timestamptz, cooldown_until timestamptz,
  consecutive_failures int not null default 0, paused_at timestamptz, pause_reason text, metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.communication_groups (
  gateway_id uuid not null references public.communication_gateways(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id text not null check(group_id like '%@g.us'), group_name text not null, participant_count int not null default 0 check(participant_count>=0),
  is_available boolean not null default true, last_synced_at timestamptz not null default now(), primary key(gateway_id,group_id)
);
create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  template_key text not null, template_name text not null, channel text not null default 'whatsapp', event_type text not null,
  content text not null, is_active boolean not null default true, is_system boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,template_key)
);
create table if not exists public.communication_event_rules (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check(event_type in('dpr.submitted','dpr.resubmitted','dpr.reviewed','dpr.returned')),
  source_module text not null default 'dpr' check(source_module='dpr'), enabled boolean not null default false,
  delivery_mode text not null default 'image_and_caption' check(delivery_mode in('text','image_and_caption')),
  template_id uuid references public.communication_templates(id), media_template_id uuid references public.communication_templates(id),
  approval_required boolean not null default true, delay_seconds int not null default 0 check(delay_seconds>=0), priority int not null default 100,
  max_attempts int not null default 3 check(max_attempts between 1 and 10), active boolean not null default true,
  created_by uuid references public.user_profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,event_type)
);
create table if not exists public.communication_project_mappings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, gateway_id uuid not null references public.communication_gateways(id) on delete cascade,
  destination_group_id text not null check(destination_group_id like '%@g.us'), destination_group_name text not null,
  attendance_enabled boolean not null default false check(attendance_enabled=false), dpr_enabled boolean not null default true,
  materials_enabled boolean not null default false, fuel_enabled boolean not null default false, machinery_enabled boolean not null default false, tasks_enabled boolean not null default false,
  active boolean not null default true, created_by uuid references public.user_profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id), foreign key(gateway_id,destination_group_id) references public.communication_groups(gateway_id,group_id)
);
create table if not exists public.communication_outbox (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  source_module text not null check(source_module='dpr'), event_type text not null check(event_type like 'dpr.%'), record_id uuid not null,
  project_id uuid not null references public.projects(id), actor_user_id uuid references public.user_profiles(id), gateway_id uuid references public.communication_gateways(id),
  destination text check(destination is null or destination like '%@g.us'), message_type text not null default 'image_and_caption', payload jsonb not null default '{}',
  rendered_caption text, media_bucket text, media_path text, status text not null check(status in('pending','awaiting_approval','processing','sent','failed','cancelled','suppressed')),
  priority int not null default 100, attempt_count int not null default 0, max_attempts int not null default 3, next_attempt_at timestamptz not null default now(),
  locked_at timestamptz, locked_by text, processed_at timestamptz, provider_message_id text, last_error text, idempotency_key text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,idempotency_key)
);
create table if not exists public.communication_delivery_attempts (
  id uuid primary key default gen_random_uuid(), outbox_id uuid not null references public.communication_outbox(id) on delete cascade,
  attempt_number int not null, started_at timestamptz not null default now(), completed_at timestamptz,
  status text not null, response_code int, provider_message_id text, error_message text, response_metadata jsonb not null default '{}', unique(outbox_id,attempt_number)
);
create table if not exists public.communication_gateway_logs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  gateway_id uuid references public.communication_gateways(id) on delete cascade, level text not null check(level in('debug','info','warn','error')),
  event_type text not null, message text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists communication_outbox_claim_idx on public.communication_outbox(status,next_attempt_at,priority,created_at);
create index if not exists communication_outbox_rate_idx on public.communication_outbox(organization_id,processed_at,destination);

do $$ begin
  alter table public.communication_settings enable row level security; alter table public.communication_gateways enable row level security;
  alter table public.communication_groups enable row level security; alter table public.communication_templates enable row level security;
  alter table public.communication_event_rules enable row level security; alter table public.communication_project_mappings enable row level security;
  alter table public.communication_outbox enable row level security; alter table public.communication_delivery_attempts enable row level security;
  alter table public.communication_gateway_logs enable row level security;
end$$;
create or replace function public.can_administer_communication() returns boolean language sql stable security definer set search_path=public as $$ select public.current_user_role()='super_admin' $$;
create policy "communication settings admin" on public.communication_settings for all to authenticated using(organization_id=public.current_organization_id() and public.can_administer_communication()) with check(organization_id=public.current_organization_id() and public.can_administer_communication());
create policy "communication gateways admin" on public.communication_gateways for all to authenticated using(organization_id=public.current_organization_id() and public.can_administer_communication()) with check(organization_id=public.current_organization_id() and public.can_administer_communication());
create policy "communication groups admin read" on public.communication_groups for select to authenticated using(organization_id=public.current_organization_id() and public.can_administer_communication());
create policy "communication templates admin" on public.communication_templates for all to authenticated using(organization_id=public.current_organization_id() and public.can_administer_communication()) with check(organization_id=public.current_organization_id() and public.can_administer_communication());
create policy "communication rules admin" on public.communication_event_rules for all to authenticated using(organization_id=public.current_organization_id() and public.can_administer_communication()) with check(organization_id=public.current_organization_id() and public.can_administer_communication());
create policy "communication mappings admin" on public.communication_project_mappings for all to authenticated using(organization_id=public.current_organization_id() and public.can_administer_communication()) with check(organization_id=public.current_organization_id() and public.can_administer_communication() and attendance_enabled=false);
create policy "communication outbox admin" on public.communication_outbox for select to authenticated using(organization_id=public.current_organization_id() and public.can_administer_communication());
create policy "communication attempts admin" on public.communication_delivery_attempts for select to authenticated using(exists(select 1 from communication_outbox o where o.id=outbox_id and o.organization_id=public.current_organization_id()) and public.can_administer_communication());
create policy "communication logs admin" on public.communication_gateway_logs for select to authenticated using(organization_id=public.current_organization_id() and public.can_administer_communication());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('communication-media','communication-media',false,10485760,array['image/png','image/jpeg']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "communication media admin read" on storage.objects for select to authenticated using(bucket_id='communication-media' and (storage.foldername(name))[1]=public.current_organization_id()::text and public.can_administer_communication());

create or replace function public.claim_communication_outbox(p_worker_id text,p_limit int default 10)
returns setof public.communication_outbox language plpgsql security definer set search_path=public as $$
begin
  return query update communication_outbox o set status='processing',locked_at=now(),locked_by=p_worker_id,updated_at=now()
  where o.id in (
    select q.id from communication_outbox q join communication_settings s on s.organization_id=q.organization_id
    join communication_gateways g on g.id=q.gateway_id
    where q.status='pending' and q.next_attempt_at<=now() and q.attempt_count<q.max_attempts
      and s.globally_enabled and s.paused_at is null and g.status='connected' and g.paused_at is null
      and (g.cooldown_until is null or g.cooldown_until<=now())
      and (select count(*) from communication_outbox x where x.organization_id=q.organization_id and x.processed_at>=now()-interval '1 minute' and x.status='sent')<s.max_per_minute
      and (select count(*) from communication_outbox x where x.organization_id=q.organization_id and x.processed_at>=now()-interval '1 hour' and x.status='sent')<s.max_per_hour
      and (select count(*) from communication_outbox x where x.organization_id=q.organization_id and x.destination=q.destination and x.processed_at>=now()-interval '1 hour' and x.status='sent')<s.max_per_group_hour
    order by q.priority,q.created_at for update skip locked limit greatest(1,least(p_limit,50))
  ) returning o.*;
end$$;
revoke all on function public.claim_communication_outbox(text,int) from public,anon,authenticated;
grant execute on function public.claim_communication_outbox(text,int) to service_role;

create or replace function public.communication_manual_action(p_outbox_id uuid,p_action text)
returns void language plpgsql security definer set search_path=public as $$
declare v public.communication_outbox;
begin
  if not public.can_administer_communication() then raise exception 'Communication Center access denied'; end if;
  select * into v from communication_outbox where id=p_outbox_id and organization_id=public.current_organization_id() for update;
  if not found then raise exception 'Delivery not found'; end if;
  if p_action='retry' and v.status in('failed','cancelled') then update communication_outbox set status='pending',next_attempt_at=now(),last_error=null,updated_at=now() where id=v.id;
  elsif p_action='approve' and v.status='awaiting_approval' then update communication_outbox set status='pending',next_attempt_at=now(),updated_at=now() where id=v.id;
  elsif p_action='cancel' and v.status in('pending','awaiting_approval','failed') then update communication_outbox set status='cancelled',processed_at=now(),updated_at=now() where id=v.id;
  else raise exception 'Invalid delivery action for current status'; end if;
end$$;
grant execute on function public.communication_manual_action(uuid,text) to authenticated;

-- Safe defaults: global switch off and admin approval on. Only DPR submission rules are enabled.
insert into public.communication_settings(organization_id) select id from public.organizations on conflict do nothing;
insert into public.communication_event_rules(organization_id,event_type,enabled,approval_required,active)
select o.id,e.event_type,e.enabled,true,true from public.organizations o cross join (values('dpr.submitted',true),('dpr.resubmitted',true),('dpr.reviewed',false),('dpr.returned',false)) e(event_type,enabled)
on conflict(organization_id,event_type) do nothing;

create or replace function public.validate_communication_mapping()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.attendance_enabled then raise exception 'Attendance communication is disabled in this phase'; end if;
  if not exists(select 1 from projects p where p.id=new.project_id and p.organization_id=new.organization_id and p.status='active' and p.deleted_at is null) then raise exception 'Cross-organization or inactive project mapping denied'; end if;
  if not exists(select 1 from communication_groups g join communication_gateways w on w.id=g.gateway_id where g.gateway_id=new.gateway_id and g.group_id=new.destination_group_id and g.organization_id=new.organization_id and w.organization_id=new.organization_id and g.is_available) then raise exception 'Destination must be a synced, available WhatsApp group in this organization'; end if;
  return new;
end$$;
drop trigger if exists validate_communication_mapping on public.communication_project_mappings;
create trigger validate_communication_mapping before insert or update on public.communication_project_mappings for each row execute function public.validate_communication_mapping();

create or replace function public.queue_communication_test(p_project_id uuid,p_message text)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor user_profiles; mapping communication_project_mappings; outbox_id uuid:=gen_random_uuid();
begin
  if not public.can_administer_communication() then raise exception 'Communication Center access denied'; end if;
  select * into actor from user_profiles where id=auth.uid();
  select * into mapping from communication_project_mappings where organization_id=actor.organization_id and project_id=p_project_id and active and dpr_enabled;
  if not found then raise exception 'Select an active approved project-group mapping'; end if;
  if length(trim(coalesce(p_message,''))) not between 1 and 1000 then raise exception 'Test message must be between 1 and 1000 characters'; end if;
  insert into communication_outbox(id,organization_id,source_module,event_type,record_id,project_id,actor_user_id,gateway_id,destination,message_type,payload,rendered_caption,status,priority,max_attempts,idempotency_key)
  values(outbox_id,actor.organization_id,'dpr','dpr.test',outbox_id,p_project_id,actor.id,mapping.gateway_id,mapping.destination_group_id,'text',jsonb_build_object('test',true),'TEST — '||trim(p_message),'awaiting_approval',10,1,'test:'||outbox_id);
  return outbox_id;
end$$;
grant execute on function public.queue_communication_test(uuid,text) to authenticated;
