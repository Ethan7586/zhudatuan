begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260908011000') then
    raise exception 'SURFACE_MEMBERSHIP_TARGET_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260908012000') then
    raise exception 'SURFACE_MEMBERSHIP_TARGET_ALREADY_APPLIED';
  end if;
end
$precondition$;

create or replace function access.identity_memberships(p_member text,p_target text,p_memberships text[])
returns table(
  id text,principal_id text,client text,organization_id text,access_version bigint,
  display_name text,organization_name text,scope_kind text,role_label text
)
language sql stable security definer
set search_path=access,member,organization,pg_temp
as $function$
  select membership.id,membership.principal_id,membership.client,membership.organization_id,
    membership.access_version,profile.display_name,organization.name,organization.kind,role.name
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  join organization.organization organization on organization.id=membership.organization_id and organization.status='active'
  left join lateral(
    select candidate.name from access.membershiprole assignment
    join access.role candidate on candidate.id=assignment.role_id and candidate.status='active'
    where assignment.membership_id=membership.id and assignment.effective_at<=clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
    order by case candidate.kind when 'owner' then 0 when 'system' then 1 else 2 end,candidate.name,candidate.id
    limit 1
  ) role on true
  where membership.status='active'
    and (p_member is not null or p_memberships is not null)
    and (p_member is null or membership.member_id=p_member)
    and (p_target is null or
      (membership.client='operator' and p_target='console') or
      (membership.client='storefront' and p_target in('storefront','miniapp')) or
      membership.client=p_target)
    and (p_memberships is null or membership.id=any(p_memberships))
$function$;

create or replace function capability.membership_operations(p_membership_id text)
returns table(operation_id text) language sql stable security definer
set search_path=capability,access,pg_temp as $function$
  with subject as (
    select membership.organization_id,case membership.client
      when 'operator' then array['console']::text[]
      when 'storefront' then array['storefront','miniapp']::text[]
      else array[membership.client]::text[] end targets
    from access.membership membership where membership.id=p_membership_id and membership.status='active'
  ), permissions as materialized (
    select permission_code,effect from access.effective_permissions(p_membership_id)
  ), effective as materialized (
    select entitlement.* from subject cross join lateral capability.effective_entitlements(array[subject.organization_id]) entitlement
  )
  select distinct operation.operation_id from subject
  cross join lateral unnest(subject.targets) requested(target)
  join effective surface on surface.scope_id=subject.organization_id and surface.capability_id='surface.'||requested.target and surface.state='enabled'
  join capability.operation operation on requested.target=any(operation.targets)
  join effective enabled on enabled.scope_id=subject.organization_id and enabled.capability_id=operation.capability_id
    and enabled.state='enabled' and enabled.dependencies_healthy
  where operation.permission_code is null or exists(
    select 1 from permissions permission where permission.permission_code=operation.permission_code and permission.effect='allow'
  )
  order by operation.operation_id
$function$;

create or replace function access.authorization_snapshot(
  p_membership_id text,p_target text,p_operation text,p_resource text
)
returns table(
  membership_id text,membership_active boolean,access_version bigint,credential_version bigint,
  organization_id text,target text,role_assignments jsonb,
  permission_allows text[],permission_denies text[],scopes jsonb,resource_scope jsonb,
  operation_ids text[],capability_version bigint
)
language sql stable security definer
set search_path=access,capability,identity,pg_temp as $function$
  with subject as materialized (
    select membership.id,membership.status='active' and principal.status='active' active,
      membership.access_version,principal.credential_version,membership.organization_id,p_target target
    from access.membership membership
    join identity.principal principal on principal.id=membership.principal_id
    where membership.id=p_membership_id and (
      (membership.client='operator' and p_target='console') or
      (membership.client='storefront' and p_target in('storefront','miniapp')) or
      membership.client=p_target)
  ), roles as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',role.id,'kind',role.kind,'status',role.status,'version',role.version,
      'effectiveAt',assignment.effective_at,'expiresAt',assignment.expires_at,
      'active',role.status='active' and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))
      order by role.id,assignment.effective_at),'[]'::jsonb) value
    from access.membershiprole assignment
    join access.role role on role.id=assignment.role_id
    where assignment.membership_id=p_membership_id
  ), permissions as materialized (
    select permission_code,effect from access.effective_permissions(p_membership_id)
  ), permission_set as (
    select coalesce(array_agg(permission_code order by permission_code)
      filter(where effect='allow'),'{}'::text[]) allows,
      coalesce(array_agg(permission_code order by permission_code)
      filter(where effect='deny'),'{}'::text[]) denies
    from permissions
  ), scope_set as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'scope',scope,'effect',effect,'effective',effective_at,'expires',expires_at)
      order by effect,scope->>'kind',scope->>'id'),'[]'::jsonb) value
    from access.effective_scopes(p_membership_id)
  ), capability_set as (
    select available.operation_ids,available.capability_version
    from capability.membership_authorization(p_membership_id) available
  )
  select subject.id,subject.active,subject.access_version,subject.credential_version,
    subject.organization_id,subject.target,roles.value,permission_set.allows,permission_set.denies,scope_set.value,
    access.scope_object(access.resource_scope(p_operation,p_resource,p_membership_id)),
    capability_set.operation_ids,capability_set.capability_version
  from subject cross join roles cross join permission_set cross join scope_set cross join capability_set
$function$;

revoke all on function access.identity_memberships(text,text,text[]),
  access.authorization_snapshot(text,text,text,text),capability.membership_operations(text) from public;
grant execute on function access.identity_memberships(text,text,text[]) to shopapp;
grant execute on function access.authorization_snapshot(text,text,text,text),
  capability.membership_operations(text) to shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260908012000',0,0,0,0,
  'select client,count(*) from access.membership where status=''active'' group by client order by client;',
  'select operation_id,targets from capability.operation where targets&&array[''store'',''supplier'',''miniapp'']::text[] order by operation_id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260908012000',encode(public.digest('20260908012000_complete_surface_membership_targets','sha256'),'hex'));
update runtime.schemahead set migration_head='20260908012000',migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:access',published_at=clock_timestamp() where artifact='commerce';

do $assert$
begin
  if not has_function_privilege('shopapp','access.identity_memberships(text,text,text[])','EXECUTE')
    or not has_function_privilege('shopapp','access.authorization_snapshot(text,text,text,text)','EXECUTE')
    or not has_function_privilege('shopjob','capability.membership_operations(text)','EXECUTE') then
    raise exception 'SURFACE_MEMBERSHIP_TARGET_PRIVILEGE_INVALID';
  end if;
  if pg_get_functiondef('access.identity_memberships(text,text,text[])'::regprocedure) not like '%membership.client=p_target%'
    or pg_get_functiondef('access.authorization_snapshot(text,text,text,text)'::regprocedure) not like '%membership.client=p_target%'
    or pg_get_functiondef('capability.membership_operations(text)'::regprocedure) not like '%unnest(subject.targets)%' then
    raise exception 'SURFACE_MEMBERSHIP_TARGET_MAPPING_INVALID';
  end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce' and migration_head='20260908012000'
    and migration_count=(select count(*) from runtime.schemaversion)) then
    raise exception 'SURFACE_MEMBERSHIP_TARGET_HEAD_INVALID';
  end if;
end
$assert$;

commit;
