begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:scope-hint-resource-precedence:v1'));

do $boundary_guard$
begin
  if not (
    (current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)
  ) then
    raise exception 'SCOPE_HINT_RESOURCE_PRECEDENCE_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829216000'
      and checksum='da02c3f15cd8fb8914a0d8a055ee6b23bf9f563c434ff72044aea8f07e23868b') then
    raise exception 'SCOPE_HINT_RESOURCE_PRECEDENCE_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260829216000') then
    raise exception 'SCOPE_HINT_RESOURCE_PRECEDENCE_FUTURE_HEAD_INVALID';
  end if;
end
$boundary_guard$;

-- Keep path resources and the client scope hint separate. Existing resources
-- always resolve from their stored owner. Only a missing role/invoice profile
-- may use a canonical hint for creation. Scope assignment authorizes the exact
-- scope being granted; the handler independently locks and checks its target
-- membership before writing.
create or replace function access.resolve_scope(
  p_membership_id text,
  p_operation text,
  p_resource text,
  p_scope_hint text
)
returns table(scope jsonb)
language sql stable security definer
set search_path=access,invoice,pg_temp as $function$
  with resolved(scope) as (
    select case
      when p_operation='access.roles.manage' then
        case when exists(select 1 from access.role role where role.id=p_resource)
          then (select access.scope_object(role.scope_id) from access.role role where role.id=p_resource)
          when p_scope_hint is not null then access.scope_object(p_scope_hint)
          else null end
      when p_operation='access.scopes.manage' then
        case when p_scope_hint is not null then access.scope_object(p_scope_hint) else null end
      when p_operation='invoice.profiles.manage' then
        case when exists(select 1 from invoice.profile profile where profile.id=p_resource)
          then (select access.scope_object(profile.owner_id) from invoice.profile profile where profile.id=p_resource)
          when p_scope_hint is not null then access.scope_object(p_scope_hint)
          else null end
      else (select legacy.scope from access.resolve_scope(
        p_membership_id,p_operation,coalesce(p_resource,p_scope_hint)) legacy)
    end
  )
  select resolved.scope from resolved where resolved.scope is not null
$function$;

revoke all on function access.resolve_scope(text,text,text,text) from public;
grant execute on function access.resolve_scope(text,text,text,text)
  to shopapp,zhudatuanidentityapi,zhudatuanwebapi,zhudatuanpurchaseapi;

insert into runtime.schemaversion(version,checksum)
values('20260829217000','e7e652071e27c4aa355dc86bc7917ab82a56d4bebc0d4c71803e7d19d1f68d97');

do $assert$
declare
  membership_id text;
  hint_scope text;
  existing_role text;
  existing_role_scope text;
  resolved_id text;
begin
  select membership.id into membership_id
  from access.membership membership where membership.status='active'
  order by (membership.client='operator') desc,membership.id limit 1;
  select organization.id into hint_scope
  from organization.organization organization
  order by (organization.kind='mall') desc,organization.id limit 1;
  select role.id,role.scope_id into existing_role,existing_role_scope
  from access.role role order by role.id limit 1;

  if membership_id is not null and hint_scope is not null then
    select resolved.scope->>'id' into resolved_id
    from access.resolve_scope(membership_id,'access.roles.manage','role:scope-hint-contract-missing',hint_scope) resolved;
    if resolved_id is distinct from hint_scope then
      raise exception 'MISSING_ROLE_SCOPE_HINT_INVALID';
    end if;
    if exists(select 1 from access.resolve_scope(
      membership_id,'access.roles.manage','role:scope-hint-contract-missing',null)) then
      raise exception 'MISSING_ROLE_WITHOUT_HINT_ALLOWED';
    end if;

    select resolved.scope->>'id' into resolved_id
    from access.resolve_scope(membership_id,'access.scopes.manage','membership:scope-hint-contract',hint_scope) resolved;
    if resolved_id is distinct from hint_scope then
      raise exception 'SCOPE_ASSIGNMENT_HINT_INVALID';
    end if;

    select resolved.scope->>'id' into resolved_id
    from access.resolve_scope(membership_id,'invoice.profiles.manage','invoice-profile:scope-hint-contract-missing',hint_scope) resolved;
    if resolved_id is distinct from hint_scope then
      raise exception 'MISSING_INVOICE_PROFILE_SCOPE_HINT_INVALID';
    end if;
    if exists(select 1 from access.resolve_scope(
      membership_id,'invoice.profiles.manage','invoice-profile:scope-hint-contract-missing',null)) then
      raise exception 'MISSING_INVOICE_PROFILE_WITHOUT_HINT_ALLOWED';
    end if;

    select resolved.scope->>'id' into resolved_id
    from access.resolve_scope(membership_id,'finance.entries.read',null,hint_scope) resolved;
    if resolved_id is distinct from hint_scope then
      raise exception 'ORDINARY_SCOPE_HINT_FALLBACK_INVALID';
    end if;
  end if;

  if membership_id is not null and existing_role is not null and hint_scope is not null then
    select resolved.scope->>'id' into resolved_id
    from access.resolve_scope(membership_id,'access.roles.manage',existing_role,hint_scope) resolved;
    if resolved_id is distinct from existing_role_scope then
      raise exception 'EXISTING_ROLE_RESOURCE_PRECEDENCE_INVALID';
    end if;
  end if;

  if to_regprocedure('access.resolve_scope(text,text,text,text)') is null
    or has_function_privilege('public','access.resolve_scope(text,text,text,text)','EXECUTE')
    or not has_function_privilege('shopapp','access.resolve_scope(text,text,text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanidentityapi','access.resolve_scope(text,text,text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','access.resolve_scope(text,text,text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanpurchaseapi','access.resolve_scope(text,text,text,text)','EXECUTE') then
    raise exception 'SCOPE_HINT_RESOLVER_ACL_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829217000'
      and checksum='e7e652071e27c4aa355dc86bc7917ab82a56d4bebc0d4c71803e7d19d1f68d97') then
    raise exception 'SCOPE_HINT_RESOURCE_PRECEDENCE_SCHEMA_VERSION_INVALID';
  end if;
end
$assert$;

commit;
