begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260908013000') then
    raise exception 'MEMBERSHIP_AUTHORIZATION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260908014000') then
    raise exception 'MEMBERSHIP_AUTHORIZATION_ALREADY_APPLIED';
  end if;
end
$precondition$;

create or replace function capability.membership_authorization(p_membership_id text)
returns table(operation_ids text[],capability_version bigint)
language sql stable security definer
set search_path=capability,access,pg_temp as $function$
  with subject as materialized (
    select membership.organization_id,case membership.client
      when 'operator' then array['console']::text[]
      when 'storefront' then array['storefront','miniapp']::text[]
      else array[membership.client]::text[] end targets
    from access.membership membership
    where membership.id=p_membership_id and membership.status='active'
  ), permissions as materialized (
    select permission_code,effect from access.effective_permissions(p_membership_id)
  ), effective as materialized (
    select entitlement.* from subject
    cross join lateral capability.effective_entitlements(array[subject.organization_id]) entitlement
  ), surfaces as materialized (
    select requested.target from subject
    cross join lateral unnest(subject.targets) requested(target)
    join effective available on available.scope_id=subject.organization_id
      and available.capability_id='surface.'||requested.target
      and available.state='enabled' and available.dependencies_healthy
  ), available as materialized (
    select distinct operation.operation_id
    from effective enabled
    join capability.operation operation on operation.capability_id=enabled.capability_id
    join surfaces surface on surface.target=any(operation.targets)
    where enabled.state='enabled' and enabled.dependencies_healthy
      and (operation.permission_code is null or exists(
        select 1 from permissions permission
        where permission.permission_code=operation.permission_code and permission.effect='allow'
      ))
  )
  select coalesce((select array_agg(available.operation_id order by available.operation_id) from available),'{}'::text[]),
    coalesce((select max(effective.capability_version) from effective),0)::bigint
$function$;

revoke all on function capability.membership_authorization(text) from public;
grant execute on function capability.membership_authorization(text) to shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260908014000',0,0,0,0,
  'select membership.id,cardinality(snapshot.operation_ids),snapshot.capability_version from access.membership membership cross join lateral capability.membership_authorization(membership.id) snapshot where membership.status=''active'' order by membership.id;',
  'select membership.id from access.membership membership cross join lateral capability.membership_authorization(membership.id) snapshot where cardinality(snapshot.operation_ids)<>(select count(distinct operation_id) from unnest(snapshot.operation_ids) operation_id) order by membership.id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260908014000',encode(public.digest('20260908014000_optimize_membership_authorization','sha256'),'hex'));
update runtime.schemahead set migration_head='20260908014000',migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:capability',published_at=clock_timestamp() where artifact='commerce';

do $assert$
declare definition text;
begin
  select pg_get_functiondef('capability.membership_authorization(text)'::regprocedure) into definition;
  if definition not like '%surfaces as materialized%'
    or definition not like '%select max(effective.capability_version) from effective%'
    or definition like '%effective left join available on true%' then
    raise exception 'MEMBERSHIP_AUTHORIZATION_PLAN_INVALID';
  end if;
  if exists(
    select 1 from access.membership membership
    cross join lateral capability.membership_authorization(membership.id) snapshot
    where membership.status='active'
      and cardinality(snapshot.operation_ids)<>
        (select count(distinct operation_id) from unnest(snapshot.operation_ids) operation_id)
  ) then
    raise exception 'MEMBERSHIP_AUTHORIZATION_DUPLICATE_OPERATION';
  end if;
  if not has_function_privilege('shopapp','capability.membership_authorization(text)','EXECUTE')
    or not has_function_privilege('shopjob','capability.membership_authorization(text)','EXECUTE') then
    raise exception 'MEMBERSHIP_AUTHORIZATION_PRIVILEGE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce'
    and migration_head='20260908014000' and migration_count=(select count(*) from runtime.schemaversion)) then
    raise exception 'MEMBERSHIP_AUTHORIZATION_HEAD_INVALID';
  end if;
end
$assert$;

commit;
