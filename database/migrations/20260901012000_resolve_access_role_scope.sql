begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260901011000') then
    raise exception 'ACCESS_ROLE_SCOPE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260901012000') then
    raise exception 'ACCESS_ROLE_SCOPE_ALREADY_APPLIED';
  end if;
end $precondition$;

create function access.role_scope(p_role text)
returns text language sql stable security definer
set search_path=access,pg_temp
set row_security=off
as $function$
  select role.scope_id from access.role role where role.id=p_role
$function$;

revoke all on function access.role_scope(text) from public,anon,authenticated,service_role;

do $replace$
declare definition text; replaced text;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  replaced:=replace(
    definition,
    'if resolved is null then select scope_id into resolved from catalog.pool where id=p_resource; end if;',
    'if resolved is null then select access.role_scope(p_resource) into resolved; end if;'||chr(10)||
    '    if resolved is null then select scope_id into resolved from catalog.pool where id=p_resource; end if;'
  );
  if replaced=definition then raise exception 'ACCESS_ROLE_SCOPE_INSERTION_POINT_MISSING'; end if;
  execute replaced;
end
$replace$;

select runtime.record_migration_evidence('20260901012000',1,1,0,0,
  'select id,scope_id from access.role order by id;',
  'select role.id,access.resource_scope(''access.roles.manage'',role.id,null) resolved from access.role role order by role.id;');

insert into runtime.schemaversion(version,checksum)
values('20260901012000',encode(public.digest('20260901012000_resolve_access_role_scope','sha256'),'hex'));

do $assert$
declare candidate record;
begin
  if to_regprocedure('access.role_scope(text)') is null then raise exception 'ACCESS_ROLE_SCOPE_RESOLVER_MISSING'; end if;
  if has_function_privilege('anon','access.role_scope(text)','EXECUTE') then raise exception 'ACCESS_ROLE_SCOPE_PUBLIC_EXECUTE'; end if;
  for candidate in select id,scope_id from access.role loop
    if access.resource_scope('access.roles.manage',candidate.id,null) is distinct from candidate.scope_id then
      raise exception 'ACCESS_ROLE_SCOPE_INVALID:%',candidate.id;
    end if;
  end loop;
end
$assert$;

commit;
