begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260910013000') then
    raise exception 'NAVIGATION_CAPABILITY_CODE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260910174500') then
    raise exception 'NAVIGATION_CAPABILITY_CODE_ALREADY_APPLIED';
  end if;
end
$precondition$;

create or replace function capability.navigation_capabilities(p_scope_ids text[],p_target text)
returns table(scope_id text,capability_code text,capability_version bigint)
language sql stable security definer set search_path=capability,pg_temp as $function$
  with effective as materialized(select * from capability.effective_entitlements(p_scope_ids)),
  surface as materialized(
    select effective.scope_id,effective.state from effective where effective.capability_id='surface.'||p_target
  )
  select effective.scope_id,catalog.id,effective.capability_version
  from effective join capability.capability catalog on catalog.id=effective.capability_id
  left join capability.operation operation on operation.capability_id=catalog.id
  join surface on surface.scope_id=effective.scope_id and surface.state='enabled'
  where effective.state='enabled' and effective.dependencies_healthy
    and (catalog.kind<>'operation' or p_target=any(operation.targets))
  order by effective.scope_id,catalog.id
$function$;

revoke all on function capability.navigation_capabilities(text[],text) from public;
grant execute on function capability.navigation_capabilities(text[],text) to shopapp,shopjob;

update capability.capabilityset
set version=version+1,updated_at=clock_timestamp();

select runtime.record_migration_evidence(
  '20260910174500',
  (select count(*) from capability.effective_entitlements(array['enterprise-zhudatuan']) effective
    join capability.capability catalog on catalog.id=effective.capability_id
    left join capability.operation operation on operation.capability_id=catalog.id
    where effective.state='enabled' and effective.dependencies_healthy
      and (catalog.kind<>'operation' or 'console'=any(operation.targets))),
  (select count(*) from capability.navigation_capabilities(array['enterprise-zhudatuan'],'console')),
  0,0,
  'select scope_id,capability_code,capability_version from capability.navigation_capabilities(array[''enterprise-zhudatuan''],''console'') order by capability_code;',
  'select operation_id,name from capability.operation operation join capability.capability capability on capability.id=operation.capability_id where operation_id like ''runtime.%'' and name<>capability.id order by operation_id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260910174500',encode(public.digest('20260910174500_publish_navigation_capability_codes','sha256'),'hex'));

update runtime.schemahead set
  migration_head='20260910174500',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:capability',published_at=clock_timestamp()
where artifact='commerce';

do $assert$
declare definition text;
begin
  select pg_get_functiondef('capability.navigation_capabilities(text[],text)'::regprocedure) into definition;
  if definition not like '%catalog.id%' or definition like '%catalog.name%' then
    raise exception 'NAVIGATION_CAPABILITY_IDENTITY_INVALID';
  end if;
  if exists(
    select 1
    from organization.organization scope
    cross join (values('console'),('storefront'),('miniapp'),('store'),('supplier')) target(id)
    cross join lateral capability.navigation_capabilities(array[scope.id],target.id) navigation
    left join capability.capability catalog on catalog.id=navigation.capability_code
    where scope.status='active' and catalog.id is null
  ) then raise exception 'NAVIGATION_CAPABILITY_UNKNOWN_CODE'; end if;
  if not exists(
    select 1 from capability.navigation_capabilities(array['enterprise-zhudatuan'],'console')
    where capability_code='runtime.jobs.read'
  ) or not exists(
    select 1 from capability.navigation_capabilities(array['enterprise-zhudatuan'],'console')
    where capability_code='runtime.uploads.create'
  ) or not exists(
    select 1 from capability.navigation_capabilities(array['enterprise-zhudatuan'],'console')
    where capability_code='runtime.imports.confirm'
  ) then raise exception 'NAVIGATION_RUNTIME_IMPORT_CAPABILITY_MISSING'; end if;
  if not has_function_privilege('shopapp','capability.navigation_capabilities(text[],text)','EXECUTE')
    or not has_function_privilege('shopjob','capability.navigation_capabilities(text[],text)','EXECUTE') then
    raise exception 'NAVIGATION_CAPABILITY_PRIVILEGE_INVALID';
  end if;
  if not exists(
    select 1 from runtime.schemahead
    where artifact='commerce' and migration_head='20260910174500'
      and migration_count=(select count(*) from runtime.schemaversion)
  ) then raise exception 'NAVIGATION_CAPABILITY_SCHEMA_HEAD_INVALID'; end if;
end
$assert$;

commit;
