-- Repeatable super-admin integrity audit for live schema reconciliation.
create or replace function public.run_database_integrity_audit()
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare r record;v_count bigint;v_tables jsonb:='[]';v_orphans jsonb:='[]';v_join text;v_nonnull text;
begin
 if public.current_user_role()<>'super_admin' then raise exception 'Super Admin permission required';end if;
 for r in
  select c.oid,c.relname,c.relrowsecurity,
   (select count(*) from pg_policy p where p.polrelid=c.oid) policy_count,
   (select count(*) from pg_constraint x where x.conrelid=c.oid and x.contype='p') pk_count,
   (select count(*) from pg_constraint x where x.conrelid=c.oid and x.contype='f') fk_count,
   (select count(*) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) trigger_count,
   (select count(*) from pg_index i where i.indrelid=c.oid) index_count
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in('r','p') order by c.relname
 loop
  execute format('select count(*) from public.%I',r.relname) into v_count;
  v_tables:=v_tables||jsonb_build_array(jsonb_build_object('table',r.relname,'rows',v_count,'rls',r.relrowsecurity,'policies',r.policy_count,'primaryKeys',r.pk_count,'foreignKeys',r.fk_count,'triggers',r.trigger_count,'indexes',r.index_count));
 end loop;

 for r in
  select con.oid,con.conname,child.relname child_table,parent.relname parent_table,con.conkey,con.confkey,con.conrelid,con.confrelid
  from pg_constraint con join pg_class child on child.oid=con.conrelid join pg_namespace ns on ns.oid=child.relnamespace join pg_class parent on parent.oid=con.confrelid
  where con.contype='f' and ns.nspname='public'
 loop
  select string_agg(format('p.%I is not distinct from c.%I',pa.attname,ca.attname),' and ' order by ck.ord),
         string_agg(format('c.%I is not null',ca.attname),' or ' order by ck.ord)
  into v_join,v_nonnull
  from unnest(r.conkey) with ordinality ck(attnum,ord)
  join unnest(r.confkey) with ordinality fk(attnum,ord) using(ord)
  join pg_attribute ca on ca.attrelid=r.conrelid and ca.attnum=ck.attnum
  join pg_attribute pa on pa.attrelid=r.confrelid and pa.attnum=fk.attnum;
  execute format('select count(*) from public.%I c where (%s) and not exists(select 1 from public.%I p where %s)',r.child_table,v_nonnull,r.parent_table,v_join) into v_count;
  if v_count>0 then v_orphans:=v_orphans||jsonb_build_array(jsonb_build_object('constraint',r.conname,'childTable',r.child_table,'parentTable',r.parent_table,'orphans',v_count));end if;
 end loop;
 return jsonb_build_object('auditedAt',now(),'tables',v_tables,'orphanForeignKeys',v_orphans,
  'summary',jsonb_build_object('tableCount',jsonb_array_length(v_tables),'orphanConstraintCount',jsonb_array_length(v_orphans),
   'functionCount',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
   'indexCount',(select count(*) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
   'triggerCount',(select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal)));
end $$;
revoke all on function public.run_database_integrity_audit() from public;
grant execute on function public.run_database_integrity_audit() to authenticated;
