begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:storefront-browse-scope:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'STOREFRONT_BROWSE_SCOPE_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260905013000'
        and checksum='437e5a0a393ead6552b7fcfcc2735f2033edfbd13ab48250bd6952bfe49c9329')
    or exists(select 1 from runtime.schemaversion where version>'20260905013000') then
    raise exception 'STOREFRONT_BROWSE_SCOPE_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

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
      when p_operation='identity.invitations.create' and p_scope_hint is not null then
        access.scope_object(p_scope_hint)
      when p_operation in('catalog.listings.read','pricing.offers.read','inventory.availability.read')
        and exists(
          select 1 from access.membership membership
          join organization.organization organization on organization.id=membership.organization_id
            and organization.kind='mall' and organization.status='active'
          where membership.id=p_membership_id and membership.client='storefront' and membership.status='active'
        ) then (
          select access.scope_object(membership.organization_id)
          from access.membership membership
          where membership.id=p_membership_id
            and (p_scope_hint is null or p_scope_hint=membership.organization_id)
        )
      else (select legacy.scope from access.resolve_scope(
        p_membership_id,p_operation,coalesce(p_resource,p_scope_hint)) legacy)
    end
  )
  select resolved.scope from resolved where resolved.scope is not null
$function$;

insert into runtime.schemaversion(version,checksum)
values('20260905014000','53560f22d8233a2ff089cdf6588c7ec710fbe9764f3e4edc81ca175c0b23cf70');

do $assert$
declare
  storefront_membership text;
  storefront_mall text;
  resolved_id text;
begin
  select membership.id,membership.organization_id
    into storefront_membership,storefront_mall
  from access.membership membership
  join organization.organization organization on organization.id=membership.organization_id
    and organization.kind='mall' and organization.status='active'
  where membership.client='storefront' and membership.status='active'
  order by membership.id limit 1;

  if storefront_membership is not null then
    select resolved.scope->>'id' into resolved_id
    from access.resolve_scope(
      storefront_membership,'catalog.listings.read',null,storefront_mall
    ) resolved;
    if resolved_id is distinct from storefront_mall then
      raise exception 'STOREFRONT_CATALOG_SCOPE_INVALID';
    end if;
    if exists(
      select 1 from access.resolve_scope(
        storefront_membership,'catalog.listings.read',null,'organization-platform-root'
      )
    ) then
      raise exception 'STOREFRONT_FOREIGN_SCOPE_HINT_ALLOWED';
    end if;
  end if;

  if has_function_privilege('public','access.resolve_scope(text,text,text,text)','execute')
    or not has_function_privilege('shopapp','access.resolve_scope(text,text,text,text)','execute')
    or not has_function_privilege('zhudatuanidentityapi','access.resolve_scope(text,text,text,text)','execute')
    or not has_function_privilege('zhudatuanwebapi','access.resolve_scope(text,text,text,text)','execute')
    or not has_function_privilege('zhudatuanpurchaseapi','access.resolve_scope(text,text,text,text)','execute')
    or not exists(select 1 from runtime.schemaversion
      where version='20260905014000' and checksum='53560f22d8233a2ff089cdf6588c7ec710fbe9764f3e4edc81ca175c0b23cf70') then
    raise exception 'STOREFRONT_BROWSE_SCOPE_INCOMPLETE';
  end if;
end
$assert$;

commit;
