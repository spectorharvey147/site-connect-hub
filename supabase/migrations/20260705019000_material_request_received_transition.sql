create or replace function public.guard_material_request_transition()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor_role text;
begin
 if auth.uid() is null then return new; end if; actor_role:=public.current_user_role();
 if old.status='approved' and new.status='received' and actor_role in ('manager','hod','admin_hr','super_admin') then return new; end if;
 if old.status in ('approved','received','rejected') and new.status is distinct from old.status then raise exception 'Final material requests cannot be reopened'; end if;
 if new.status='approved' and old.status<>'submitted' then raise exception 'Only submitted material requests can be approved'; end if;
 if new.status='approved' and actor_role not in ('manager','hod','admin_hr','super_admin') then raise exception 'Only an authorised approver can approve material requests'; end if;
 if new.approved_by is distinct from old.approved_by and new.approved_by is distinct from auth.uid() then raise exception 'approved_by must match the authenticated approver'; end if;
 return new;
end;$$;
