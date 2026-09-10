begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260910174500') then
    raise exception 'AUTHORIZATION_CAPABILITY_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260910234000') then
    raise exception 'AUTHORIZATION_CAPABILITY_ALREADY_APPLIED';
  end if;
end
$precondition$;

create or replace function capability.membership_authorization(p_membership_id text)
returns table(operation_ids text[],capability_version bigint)
language sql stable security definer
set search_path=capability,access,organization,pg_temp as $function$
  with recursive subject as materialized (
    select membership.organization_id,case membership.client
      when 'operator' then array['console']::text[]
      when 'storefront' then array['storefront','miniapp']::text[]
      else array[membership.client]::text[] end targets
    from access.membership membership
    where membership.id=p_membership_id and membership.status='active'
  ), lineage as materialized (
    select subject.organization_id scope_id,subject.organization_id ancestor_id,0 depth
    from subject
    union all
    select subject.organization_id,closure.ancestor_id,closure.depth
    from subject join organization.unitclosure closure
      on closure.descendant_id=subject.organization_id and closure.depth>0
  ), active as materialized (
    select entitlement.capability_id,entitlement.state
    from lineage join capability.entitlement entitlement
      on entitlement.scope_id=lineage.ancestor_id
    where entitlement.effective_at<=clock_timestamp()
      and (entitlement.expires_at is null or entitlement.expires_at>clock_timestamp())
  ), base as materialized (
    select catalog.id capability_id,
      catalog.status='active'
        and coalesce(bool_or(active.state='enabled'),false)
        and not coalesce(bool_or(active.state='disabled'),false) enabled
    from capability.capability catalog
    left join active on active.capability_id=catalog.id
    group by catalog.id,catalog.status
  ), dependencytree(root,required) as (
    select capability_id,depends_on_id from capability.dependency
    union
    select dependencytree.root,dependency.depends_on_id
    from dependencytree join capability.dependency dependency
      on dependency.capability_id=dependencytree.required
  ), healthy as materialized (
    select base.capability_id from base
    where base.enabled and not exists(
      select 1 from dependencytree
      left join base required on required.capability_id=dependencytree.required
      where dependencytree.root=base.capability_id and not coalesce(required.enabled,false)
    )
  ), permission_catalog as materialized (
    select id,code from access.permission where status='active'
  ), permission_candidates as materialized (
    select permission.code,mapping.effect
    from access.membershiprole assignment
    join access.role role on role.id=assignment.role_id and role.status='active'
    join access.rolepermission mapping on mapping.role_id=role.id
    join permission_catalog permission on permission.id=mapping.permission_id
    where assignment.membership_id=p_membership_id
      and assignment.effective_at<=clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
    union all
    select permission.code,override.effect
    from access.membershipoverride override
    join permission_catalog permission on permission.id=override.permission_id
    where override.membership_id=p_membership_id and override.revoked_at is null
      and override.effective_at<=clock_timestamp()
      and (override.expires_at is null or override.expires_at>clock_timestamp())
  ), permissions as materialized (
    select code permission_code,
      case when bool_or(effect='deny') then 'deny' else 'allow' end effect
    from permission_candidates group by code
    having bool_or(effect='deny') or bool_or(effect='allow')
  ), operation_catalog as materialized (
    select operation_id,capability_id,permission_code,targets from capability.operation
  ), available as materialized (
    select distinct operation.operation_id
    from subject cross join lateral unnest(subject.targets) requested(target)
    join healthy surface on surface.capability_id='surface.'||requested.target
    join operation_catalog operation on requested.target=any(operation.targets)
    join healthy enabled on enabled.capability_id=operation.capability_id
    where operation.permission_code is null or exists(
      select 1 from permissions permission
      where permission.permission_code=operation.permission_code and permission.effect='allow'
    )
  ), version as (
    select case when exists(select 1 from subject) then
      coalesce((select sum(capabilityset.version) from lineage
        join capability.capabilityset capabilityset on capabilityset.scope_id=lineage.ancestor_id),0)
      +coalesce((select sum(catalog.version) from capability.capability catalog),0)
      else 0 end value
  )
  select coalesce((select array_agg(operation_id order by operation_id) from available),'{}'::text[]),
    version.value::bigint
  from version
$function$;

revoke all on function capability.membership_authorization(text) from public;
grant execute on function capability.membership_authorization(text) to shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260910234000',
  (select count(*) from access.membership where status='active'),
  (select count(*) from access.membership membership
    cross join lateral capability.membership_authorization(membership.id) snapshot
    where membership.status='active' and cardinality(snapshot.operation_ids)=
      (select count(distinct operation_id) from unnest(snapshot.operation_ids) operation_id)),
  0,0,
  'select membership.id,cardinality(snapshot.operation_ids),snapshot.capability_version from access.membership membership cross join lateral capability.membership_authorization(membership.id) snapshot where membership.status=''active'' order by membership.id;',
  'select membership.id from access.membership membership cross join lateral capability.membership_authorization(membership.id) snapshot where membership.status=''active'' and snapshot.operation_ids is distinct from array(select operation_id from capability.membership_operations(membership.id)) order by membership.id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260910234000',encode(public.digest('20260910234000_optimize_authorization_capabilities','sha256'),'hex'));

update runtime.schemahead set
  migration_head='20260910234000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:capability',published_at=clock_timestamp()
where artifact='commerce';

do $assert$
declare definition text;
begin
  select lower(pg_get_functiondef('capability.membership_authorization(text)'::regprocedure)) into definition;
  if definition not like '%permission_catalog as materialized%'
    or definition not like '%operation_catalog as materialized%'
    or definition like '%effective_entitlements(%' then
    raise exception 'AUTHORIZATION_CAPABILITY_PLAN_INVALID';
  end if;
  if exists(
    select 1 from access.membership membership
    cross join lateral capability.membership_authorization(membership.id) snapshot
    where membership.status='active' and snapshot.operation_ids is distinct from
      array(select operation_id from capability.membership_operations(membership.id))
  ) then raise exception 'AUTHORIZATION_CAPABILITY_SEMANTICS_INVALID'; end if;
  if not has_function_privilege('shopapp','capability.membership_authorization(text)','EXECUTE')
    or not has_function_privilege('shopjob','capability.membership_authorization(text)','EXECUTE') then
    raise exception 'AUTHORIZATION_CAPABILITY_PRIVILEGE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce'
    and migration_head='20260910234000'
    and migration_count=(select count(*) from runtime.schemaversion)) then
    raise exception 'AUTHORIZATION_CAPABILITY_HEAD_INVALID';
  end if;
end
$assert$;

commit;
