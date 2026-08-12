alter table public.attendance add column if not exists check_in_selfie_path text,
  add column if not exists check_out_selfie_path text,
  add column if not exists check_in_captured_at timestamptz,
  add column if not exists check_out_captured_at timestamptz,
  add column if not exists check_in_client_mutation_id text,
  add column if not exists check_out_client_mutation_id text;
create unique index if not exists attendance_check_in_mutation_uidx on public.attendance(user_id,check_in_client_mutation_id) where check_in_client_mutation_id is not null;
create unique index if not exists attendance_check_out_mutation_uidx on public.attendance(user_id,check_out_client_mutation_id) where check_out_client_mutation_id is not null;

create or replace function public.attendance_punch(p_action text,p_project_id uuid,p_latitude numeric,p_longitude numeric,p_accuracy int,p_selfie_path text,p_captured_at timestamptz,p_client_mutation_id text)
returns public.attendance language plpgsql security invoker set search_path=public as $$
declare v_record public.attendance;
begin
 if nullif(p_client_mutation_id,'') is null then raise exception 'Client mutation ID is required'; end if;
 select * into v_record from attendance where user_id=auth.uid() and (check_in_client_mutation_id=p_client_mutation_id or check_out_client_mutation_id=p_client_mutation_id);
 if found then return v_record; end if;
 if nullif(p_selfie_path,'') is null then raise exception 'Attendance selfie is required'; end if;
 if p_captured_at is null or p_captured_at > now()+interval '5 minutes' or p_captured_at < now()-interval '24 hours' then raise exception 'Attendance capture time is invalid or expired'; end if;
 v_record:=public.attendance_punch(p_action,p_project_id,p_latitude,p_longitude,p_accuracy);
 if p_action='check_in' then update attendance set check_in_selfie_path=p_selfie_path,check_in_captured_at=p_captured_at,check_in_client_mutation_id=p_client_mutation_id where id=v_record.id returning * into v_record;
 else update attendance set check_out_selfie_path=p_selfie_path,check_out_captured_at=p_captured_at,check_out_client_mutation_id=p_client_mutation_id where id=v_record.id returning * into v_record; end if;
 return v_record;
end$$;
grant execute on function public.attendance_punch(text,uuid,numeric,numeric,int,text,timestamptz,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('attendance-selfies','attendance-selfies',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false;
drop policy if exists "users upload own attendance selfies" on storage.objects;
create policy "users upload own attendance selfies" on storage.objects for insert to authenticated
with check(bucket_id='attendance-selfies' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "attendance selfies visible to owner and admins" on storage.objects;
create policy "attendance selfies visible to owner and admins" on storage.objects for select to authenticated using
(bucket_id='attendance-selfies' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_user_role() in ('manager','hod','admin_hr','super_admin')));

create table if not exists public.push_subscriptions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,user_id uuid not null references public.user_profiles(id) on delete cascade,endpoint text not null,p256dh text not null,auth_key text not null,user_agent text,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,endpoint));
alter table public.push_subscriptions enable row level security;
create policy "users manage own push subscriptions" on public.push_subscriptions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and organization_id=public.current_organization_id());

create or replace function public.sync_project_conversation_members(p_project_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_conversation uuid; v_org uuid; v_name text;
begin
 select organization_id,name into v_org,v_name from projects where id=p_project_id;
 if v_org is null or not public.can_access_project(p_project_id) then raise exception 'Project access denied'; end if;
 select id into v_conversation from conversations where project_id=p_project_id and type='project' order by created_at limit 1;
 if v_conversation is null then insert into conversations(type,title,description,project_id,created_by) values('project',v_name||' Broadcast','Official project announcements and site coordination.',p_project_id,auth.uid()) returning id into v_conversation; end if;
 insert into conversation_members(conversation_id,user_id) select v_conversation,a.user_id from user_project_assignments a where a.project_id=p_project_id and a.status='active' on conflict(conversation_id,user_id) do nothing;
 insert into conversation_members(conversation_id,user_id) values(v_conversation,auth.uid()) on conflict do nothing;
 return v_conversation;
end$$;
grant execute on function public.sync_project_conversation_members(uuid) to authenticated;
