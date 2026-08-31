begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830100000') then
    raise exception 'UNIFIED_ACCESS_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830101000') then
    raise exception 'UNIFIED_ACCESS_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table access.role add column kind text not null default 'custom';
alter table access.role add constraint role_kind_valid check(kind in('custom','system','owner'));

update access.role target
set kind=case
  when target.id='role-platform-owner-v2' then 'owner'
  when target.id in('role:self','role-zhudatuan-storefront-member') then 'system'
  else 'custom'
end;

create unique index access_role_one_owner_per_scope
on access.role(scope_id) where kind='owner';
create index access_role_kind_status on access.role(kind,status,scope_id,id);
create index access_permission_role_effect on access.rolepermission(role_id,effect,permission_id);
create index access_override_effective on access.membershipoverride(membership_id,effect,effective_at,expires_at,revoked_at,permission_id);
create index access_scope_effective on access.scopegrant(membership_id,effect,effective_at,expires_at,scope_kind,scope_id);

create function access.effective_permissions(p_membership_id text)
returns table(permission_code text,effect text)
language sql stable security definer set search_path=access,pg_temp as $function$
  with candidates as (
    select permission.code,mapping.effect
    from access.membershiprole assignment
    join access.role role on role.id=assignment.role_id and role.status='active'
    join access.rolepermission mapping on mapping.role_id=role.id
    join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
    where assignment.membership_id=p_membership_id
      and assignment.effective_at<=clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
    union all
    select permission.code,override.effect
    from access.membershipoverride override
    join access.permission permission on permission.id=override.permission_id and permission.status='active'
    where override.membership_id=p_membership_id and override.revoked_at is null
      and override.effective_at<=clock_timestamp()
      and (override.expires_at is null or override.expires_at>clock_timestamp())
  ), resolved as (
    select code,bool_or(effect='deny') denied,bool_or(effect='allow') allowed
    from candidates group by code
  )
  select code,case when denied then 'deny' else 'allow' end
  from resolved where denied or allowed order by code
$function$;

create function access.effective_scopes(p_membership_id text)
returns table(scope jsonb,effect text,effective_at timestamptz,expires_at timestamptz)
language sql stable security definer set search_path=access,pg_temp as $function$
  select coalesce(access.scope_object(grantrow.scope_id),jsonb_build_object(
      'kind',grantrow.scope_kind,'id',grantrow.scope_id,'path','[]'::jsonb)),
    grantrow.effect,grantrow.effective_at,grantrow.expires_at
  from access.scopegrant grantrow
  where grantrow.membership_id=p_membership_id
    and grantrow.effective_at<=clock_timestamp()
    and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())
  order by grantrow.effect desc,grantrow.scope_path,grantrow.scope_id
$function$;

create or replace function capability.membership_operations(p_membership_id text)
returns table(operation_id text) language sql stable security definer
set search_path=capability,access,organization,pg_temp as $function$
  with subject as (
    select membership.organization_id,
      case membership.client when 'operator' then 'console' else membership.client end target
    from access.membership membership
    where membership.id=p_membership_id and membership.status='active'
  ), permissions as materialized (
    select permission_code,effect from access.effective_permissions(p_membership_id)
  )
  select operation.operation_id
  from subject
  join capability.operation operation on operation.audience=subject.target
  where exists(
      select 1 from organization.unitclosure closure
      join capability.entitlement entitlement on entitlement.scope_id=closure.ancestor_id
        and entitlement.capability_id=operation.capability_id and entitlement.state='enabled'
        and entitlement.effective_at<=clock_timestamp()
        and (entitlement.expires_at is null or entitlement.expires_at>clock_timestamp())
      where closure.descendant_id=subject.organization_id)
    and (operation.permission_code is null or exists(
      select 1 from permissions permission
      where permission.permission_code=operation.permission_code and permission.effect='allow'))
  order by operation.operation_id
$function$;

create or replace function capability.membership_authorization(p_membership_id text)
returns table(operation_ids text[],capability_version bigint)
language sql stable security definer set search_path=capability,access,organization,pg_temp as $function$
  with membership_scope as (
    select membership.organization_id
    from access.membership membership
    where membership.id=p_membership_id and membership.status='active'
  ), current_version as (
    select coalesce(max(greatest(entitlement.version,capability.version)),0)::bigint value
    from membership_scope membership
    join organization.unitclosure closure on closure.descendant_id=membership.organization_id
    join capability.entitlement entitlement on entitlement.scope_id=closure.ancestor_id
      and entitlement.state='enabled' and entitlement.effective_at<=clock_timestamp()
      and (entitlement.expires_at is null or entitlement.expires_at>clock_timestamp())
    join capability.capability capability on capability.id=entitlement.capability_id
  )
  select coalesce(array_agg(available.operation_id order by available.operation_id)
    filter(where available.operation_id is not null),'{}'::text[]),current_version.value
  from current_version
  left join capability.membership_operations(p_membership_id) available on true
  group by current_version.value
$function$;

create or replace function access.navigation_access(p_membership_ids text[])
returns table(membership_id text,permission_code text,effect text,access_version bigint)
language sql stable security definer set search_path=access,pg_temp as $function$
  select membership.id,permission.permission_code,permission.effect,membership.access_version
  from access.membership membership
  left join lateral access.effective_permissions(membership.id) permission on true
  where membership.id=any(p_membership_ids) and membership.status='active'
  order by membership.id,permission.permission_code
$function$;

create function access.authorization_snapshot(
  p_membership_id text,p_target text,p_operation text,p_resource text
)
returns table(
  membership_id text,membership_active boolean,access_version bigint,
  permission_allows text[],permission_denies text[],scopes jsonb,resource_scope jsonb,
  operation_ids text[],capability_version bigint
)
language sql stable security definer
set search_path=access,capability,pg_temp as $function$
  with subject as materialized (
    select membership.id,membership.status='active' active,membership.access_version
    from access.membership membership
    where membership.id=p_membership_id
      and case membership.client when 'operator' then 'console' else membership.client end=p_target
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
  select subject.id,subject.active,subject.access_version,permission_set.allows,permission_set.denies,
    scope_set.value,access.scope_object(access.resource_scope(p_operation,p_resource,p_membership_id)),
    capability_set.operation_ids,capability_set.capability_version
  from subject cross join permission_set cross join scope_set cross join capability_set
$function$;

drop function access.resolve_membership(text);
drop function access.membership_version(text);
drop function access.resolve_scope(text,text,text);

revoke all on function access.effective_permissions(text),access.effective_scopes(text),
  access.authorization_snapshot(text,text,text,text) from public;
grant execute on function access.effective_permissions(text),access.effective_scopes(text),
  access.authorization_snapshot(text,text,text,text) to shopapp;

select runtime.record_migration_evidence('20260830101000',0,0,0,0,
  'create index concurrently if not exists access_snapshot_membershiprole_live on access.membershiprole(membership_id,effective_at,expires_at,role_id);',
  'select kind,status,count(*) from access.role group by kind,status order by kind,status;');
insert into runtime.schemaversion(version,checksum)
values('20260830101000',encode(public.digest('20260830101000_unify_access_policy','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from access.role where kind not in('custom','system','owner')) then
    raise exception 'ACCESS_ROLE_KIND_INVALID';
  end if;
  if (select kind from access.role where id='role-platform-owner-v2')<>'owner' then
    raise exception 'ACCESS_OWNER_ROLE_KIND_INVALID';
  end if;
  if to_regprocedure('access.authorization_snapshot(text,text,text,text)') is null then
    raise exception 'AUTHORIZATION_SNAPSHOT_MISSING';
  end if;
  if to_regprocedure('access.resolve_membership(text)') is not null
    or to_regprocedure('access.resolve_scope(text,text,text)') is not null
    or to_regprocedure('access.membership_version(text)') is not null then
    raise exception 'SPLIT_ACCESS_DECISION_REMAINS';
  end if;
end $assert$;

commit;
