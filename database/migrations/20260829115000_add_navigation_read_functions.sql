begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829114000') then raise exception 'NAVIGATION_READ_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829115000') then raise exception 'NAVIGATION_READ_ALREADY_APPLIED'; end if;
end $precondition$;

create function identity.navigation_identity(p_principal_id text,p_membership_id text)
returns table(principal_id text,membership_id text,membership_status text,access_version bigint,assurance smallint)
language sql stable security definer set search_path=identity,access,member,pg_temp as $function$
  select principal.id,membership.id,membership.status,membership.access_version,
    coalesce((select max(assurance.level) from identity.assurance assurance where assurance.principal_id=principal.id
      and (assurance.expires_at is null or assurance.expires_at>clock_timestamp())),1)::smallint
  from identity.principal principal
  join member.profile profile on profile.principal_id=principal.id and profile.status='active'
  join access.membership membership on membership.id=p_membership_id and membership.member_id=profile.id
  where principal.id=p_principal_id and principal.status='active'
$function$;
create function access.navigation_access(p_membership_ids text[])
returns table(membership_id text,permission_code text,effect text,access_version bigint)
language sql stable security definer set search_path=access,pg_temp as $function$
  select membership.id,permission.code,mapping.effect,membership.access_version
  from access.membership membership
  left join access.membershiprole assignment on assignment.membership_id=membership.id
    and assignment.effective_at<=clock_timestamp() and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
  left join access.rolepermission mapping on mapping.role_id=assignment.role_id
  left join access.permission permission on permission.id=mapping.permission_id
  where membership.id=any(p_membership_ids) and membership.status='active'
  order by membership.id,permission.code,mapping.effect
$function$;
create function organization.navigation_scopes(p_membership_ids text[])
returns table(membership_id text,scope_id text,scope_kind text,scope_status text,scope_version bigint,is_default boolean)
language sql stable security definer set search_path=access,organization,pg_temp as $function$
  select distinct membership.id,scope.id,scope.kind,scope.status,scope.version,scope.id=membership.organization_id
  from access.membership membership
  join access.scopegrant allowed on allowed.membership_id=membership.id and allowed.effect='allow'
    and allowed.effective_at<=clock_timestamp() and (allowed.expires_at is null or allowed.expires_at>clock_timestamp())
  join organization.unitclosure closure on closure.ancestor_id=allowed.scope_id
  join organization.organization scope on scope.id=closure.descendant_id
  where membership.id=any(p_membership_ids) and membership.status='active' and scope.status='active'
    and not exists(select 1 from access.scopegrant denied join organization.unitclosure deniedclosure on deniedclosure.ancestor_id=denied.scope_id
      where denied.membership_id=membership.id and denied.effect='deny' and deniedclosure.descendant_id=scope.id
        and denied.effective_at<=clock_timestamp() and (denied.expires_at is null or denied.expires_at>clock_timestamp()))
  order by membership.id,scope.id
$function$;
create function capability.navigation_capabilities(p_scope_ids text[])
returns table(scope_id text,capability_code text,capability_version bigint)
language sql stable security definer set search_path=capability,organization,pg_temp as $function$
  select requested.scope_id,capability.name,max(greatest(entitlement.version,capability.version))
  from unnest(p_scope_ids) requested(scope_id)
  join organization.unitclosure closure on closure.descendant_id=requested.scope_id
  join capability.entitlement entitlement on entitlement.scope_id=closure.ancestor_id
  join capability.capability capability on capability.id=entitlement.capability_id
  where entitlement.state='enabled'
    and entitlement.effective_at<=clock_timestamp() and (entitlement.expires_at is null or entitlement.expires_at>clock_timestamp())
  group by requested.scope_id,capability.name
  order by requested.scope_id,capability.name
$function$;

create function capability.membership_authorization(p_membership_id text)
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

revoke all on function identity.navigation_identity(text,text),access.navigation_access(text[]),organization.navigation_scopes(text[]),capability.navigation_capabilities(text[]),capability.membership_authorization(text) from public;
grant execute on function identity.navigation_identity(text,text),access.navigation_access(text[]),organization.navigation_scopes(text[]),capability.navigation_capabilities(text[]),capability.membership_authorization(text) to shopapp;
create index access_navigation_membershiprole on access.membershiprole(membership_id,effective_at,expires_at,role_id);
create index capability_navigation_scope on capability.entitlement(scope_id,state,effective_at,expires_at,capability_id);

select runtime.record_migration_evidence('20260829115000',0,0,0,0,
  'create index concurrently if not exists access_navigation_membershiprole_live on access.membershiprole(membership_id,effective_at,expires_at,role_id);',
  'select routine_schema,routine_name,security_type from information_schema.routines where routine_name like ''navigation_%'' order by routine_schema,routine_name;');
insert into runtime.schemaversion(version,checksum) values('20260829115000',encode(public.digest('20260829115000_add_navigation_read_functions','sha256'),'hex'));

commit;
