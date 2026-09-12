begin;

select pg_advisory_xact_lock(hashtext('identity:storefront-member-context-projection:v2'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'STOREFRONT_MEMBER_CONTEXT_PROJECTION_DATABASE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260912210000'
        and checksum='f1cf6a31ded78182cd64d96f45d81d75ef658b191a4c56bd8402cca18f0de485')
    or exists(select 1 from runtime.schemaversion where version>'20260912210000') then
    raise exception 'STOREFRONT_MEMBER_CONTEXT_PROJECTION_PREDECESSOR_INVALID';
  end if;
  if to_regrole('zhudatuanidentityapi') is null
    or to_regclass('organization.membernoderegistration') is null
    or to_regclass('organization.node') is null
    or to_regclass('organization.noderelation') is null then
    raise exception 'STOREFRONT_MEMBER_CONTEXT_PROJECTION_DEPENDENCY_MISSING';
  end if;
end
$precondition$;

create function identity.resolve_storefront_member_context(
  p_membership_id text,p_organization_id text
)
returns table(
  membership_id text,node_id text,parent_node_id text,signed_level text,node_profile text,
  parent_kind text,parent_display_name text,parent_signed_level text
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select membership.id,member_node.node_id,member_node.parent_node_id,
    member_node.signed_level,member_node.node_profile,
    case when parent_node.node_profile='consumer' then 'member' else 'mall' end,
    case when parent_node.node_profile='consumer' then parent_member.display_name else organization.name end,
    parent_relation.signed_level
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id
  join organization.organization organization on organization.id=membership.organization_id
  join lateral (
    select node.id node_id,relation.line_id,relation.parent_node_id,relation.signed_level,node.node_profile
    from organization.membernoderegistration registration
    join organization.node node on node.id=registration.node_id and node.status='active'
      and node.node_profile='consumer'
    join organization.noderelation relation on relation.node_id=node.id
      and relation.line_id=registration.line_id and relation.superseded_at is null
      and relation.signed_level in('L6','L7','L8','L9','L10','L11')
    where registration.membership_id=membership.id
    order by registration.created_at desc,registration.registration_id desc
    limit 1
  ) member_node on true
  join organization.node parent_node on parent_node.id=member_node.parent_node_id and parent_node.status='active'
  join organization.noderelation parent_relation on parent_relation.node_id=parent_node.id
    and parent_relation.line_id=member_node.line_id and parent_relation.superseded_at is null
  left join lateral (
    select parent_profile.display_name
    from organization.membernoderegistration parent_registration
    join access.membership parent_membership on parent_membership.id=parent_registration.membership_id
      and parent_membership.organization_id=membership.organization_id
      and parent_membership.client='storefront'
    join member.profile parent_profile on parent_profile.id=parent_membership.member_id
    where parent_registration.node_id=parent_node.id and parent_registration.line_id=member_node.line_id
    order by parent_registration.created_at desc,parent_registration.registration_id desc
    limit 1
  ) parent_member on parent_node.node_profile='consumer'
  where membership.id=p_membership_id and membership.organization_id=p_organization_id
    and membership.client='storefront'
$function$;

alter function identity.resolve_storefront_member_context(text,text) owner to shopmigration;
revoke all on function identity.resolve_storefront_member_context(text,text) from public;
grant execute on function identity.resolve_storefront_member_context(text,text) to zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260912220000','178ce847d8cfc1719f1b6bb6956ae75a71065a2ec1da08b278fd318be95a72e2');

do $assert$
begin
  if not exists(select 1 from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='identity.resolve_storefront_member_context(text,text)'::regprocedure
        and function.prosecdef and owner.rolname='shopmigration')
    or has_function_privilege('public','identity.resolve_storefront_member_context(text,text)','execute')
    or not has_function_privilege('zhudatuanidentityapi',
      'identity.resolve_storefront_member_context(text,text)','execute')
    or has_table_privilege('zhudatuanidentityapi','organization.membernoderegistration','select,insert,update,delete')
    or has_table_privilege('zhudatuanidentityapi','organization.node','select,insert,update,delete')
    or has_table_privilege('zhudatuanidentityapi','organization.noderelation','select,insert,update,delete')
    or not exists(select 1 from runtime.schemaversion where version='20260912220000'
      and checksum='178ce847d8cfc1719f1b6bb6956ae75a71065a2ec1da08b278fd318be95a72e2') then
    raise exception 'STOREFRONT_MEMBER_CONTEXT_PROJECTION_INCOMPLETE';
  end if;
end
$assert$;

commit;
