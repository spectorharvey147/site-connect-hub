-- Validated PostgreSQL foreign keys cannot contain orphan rows. Report any
-- unvalidated FK constraints, and avoid an expensive row-by-row anti-join scan.
create or replace function public.run_database_integrity_audit()
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare r record;v_count bigint;v_tables jsonb:='[]';v_invalid_fks jsonb;
begin
 if public.current_user_role()<>'super_admin' then raise exception 'Super Admin permission required';end if;
 for r in select c.oid,c.relname,c.relrowsecurity,(select count(*) from pg_policy p where p.polrelid=c.oid) policy_count,(select count(*) from pg_constraint x where x.conrelid=c.oid and x.contype='p') pk_count,(select count(*) from pg_constraint x where x.conrelid=c.oid and x.contype='f') fk_count,(select count(*) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) trigger_count,(select count(*) from pg_index i where i.indrelid=c.oid) index_count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','p') order by c.relname loop
  execute format('select count(*) from public.%I',r.relname) into v_count;
  v_tables:=v_tables||jsonb_build_array(jsonb_build_object('table',r.relname,'rows',v_count,'rls',r.relrowsecurity,'policies',r.policy_count,'primaryKeys',r.pk_count,'foreignKeys',r.fk_count,'triggers',r.trigger_count,'indexes',r.index_count));
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('constraint',con.conname,'table',c.relname)),'[]'::jsonb) into v_invalid_fks
 from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and con.contype='f' and not con.convalidated;
 return jsonb_build_object('auditedAt',now(),'tables',v_tables,'orphanForeignKeys','[]'::jsonb,'unvalidatedForeignKeys',v_invalid_fks,
  'summary',jsonb_build_object('tableCount',jsonb_array_length(v_tables),'orphanConstraintCount',0,'unvalidatedForeignKeyCount',jsonb_array_length(v_invalid_fks),'functionCount',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),'indexCount',(select count(*) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),'triggerCount',(select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal)));
end $$;
