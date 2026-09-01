begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902015000') then
    raise exception 'INHERITED_SUPPORT_SLA_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902016000') then
    raise exception 'INHERITED_SUPPORT_SLA_ALREADY_APPLIED';
  end if;
end
$precondition$;

create function support.resolve_sla(p_scope text,p_priority text)
returns table(response_seconds integer,resolution_seconds integer)
language sql
stable
security definer
set search_path=pg_catalog,pg_temp
as $function$
  select policy.response_seconds,policy.resolution_seconds
  from organization.unitclosure closure
  join support.sla policy on policy.scope_id=closure.ancestor_id and policy.priority=p_priority
  where closure.descendant_id=p_scope
    and p_priority in('low','normal','high','urgent')
    and access.scope_allowed(p_scope)
  order by closure.depth,policy.version desc
  limit 1
$function$;

revoke all on function support.resolve_sla(text,text) from public,shopjob;
grant execute on function support.resolve_sla(text,text) to shopapp;

select runtime.record_migration_evidence(
  '20260902016000',1,1,0,0,
  'select p.oid::regprocedure function_name,pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer from pg_proc p where p.oid=''support.resolve_sla(text,text)''::regprocedure;',
  'select has_function_privilege(''shopapp'',''support.resolve_sla(text,text)'',''execute'') shopapp_execute,has_function_privilege(''shopjob'',''support.resolve_sla(text,text)'',''execute'') shopjob_execute;'
);

insert into runtime.schemaversion(version,checksum)
values(
  '20260902016000',
  encode(public.digest('20260902016000_resolve_inherited_support_sla','sha256'),'hex')
);

do $assert$
declare
  resolved record;
begin
  perform set_config('app.scope_id','mall-zhudatuan',true);
  select * into resolved from support.resolve_sla('mall-zhudatuan','normal');
  if resolved.response_seconds<>14400 or resolved.resolution_seconds<>172800 then
    raise exception 'INHERITED_SUPPORT_SLA_RESOLUTION_INVALID';
  end if;
  if exists(select 1 from support.resolve_sla('mall-demo','normal')) then
    raise exception 'INHERITED_SUPPORT_SLA_SCOPE_LEAK';
  end if;
  if not has_function_privilege('shopapp','support.resolve_sla(text,text)','execute')
    or has_function_privilege('shopjob','support.resolve_sla(text,text)','execute') then
    raise exception 'INHERITED_SUPPORT_SLA_PRIVILEGE_INVALID';
  end if;
end
$assert$;

commit;
