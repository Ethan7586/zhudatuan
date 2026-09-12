begin;

select pg_advisory_xact_lock(hashtext('identity:storefront-member-node-projection:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='zhudatuanroot')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'STOREFRONT_MEMBER_NODE_PROJECTION_DATABASE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260912181000'
      and checksum='7f572c8552da254682185a5262e6a94bb7ead0f51ed3ab1f46fe386718b0a9e3')
    or exists(select 1 from runtime.schemaversion where version>'20260912181000') then
    raise exception 'STOREFRONT_MEMBER_NODE_PROJECTION_PREDECESSOR_INVALID';
  end if;
  if to_regrole('zhudatuanidentityapi') is null
    or to_regclass('organization.membernoderegistration') is null
    or to_regclass('organization.node') is null
    or to_regclass('organization.noderelation') is null then
    raise exception 'STOREFRONT_MEMBER_NODE_PROJECTION_DEPENDENCY_MISSING';
  end if;
end
$precondition$;

create function identity.resolve_storefront_member_node(
  p_membership_id text,p_organization_id text
)
returns table(
  membership_id text,node_id text,parent_node_id text,signed_level text,node_profile text
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select membership.id,node.id,relation.parent_node_id,relation.signed_level,node.node_profile
  from access.membership membership
  join organization.membernoderegistration registration on registration.membership_id=membership.id
  join organization.node node on node.id=registration.node_id and node.status='active'
  join organization.noderelation relation on relation.node_id=node.id and relation.superseded_at is null
  where membership.id=p_membership_id and membership.organization_id=p_organization_id
    and membership.client='storefront'
$function$;

alter function identity.resolve_storefront_member_node(text,text) owner to zhudatuanroot;
revoke all on function identity.resolve_storefront_member_node(text,text) from public;
grant execute on function identity.resolve_storefront_member_node(text,text) to zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260912182000','b39dbc952e29463840d9d706edacf43a83418ad33a26640be184c56764e2c62a');

insert into supabase_migrations.schema_migrations(version,statements,name)
values('20260912182000',array[]::text[],'20260912182000_create_storefront_member_node_projection.sql');

do $assert$
begin
  if to_regprocedure('identity.resolve_storefront_member_node(text,text)') is null
    or not exists(select 1 from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='identity.resolve_storefront_member_node(text,text)'::regprocedure
        and function.prosecdef and owner.rolname='zhudatuanroot')
    or has_function_privilege('public','identity.resolve_storefront_member_node(text,text)','execute')
    or not has_function_privilege('zhudatuanidentityapi','identity.resolve_storefront_member_node(text,text)','execute')
    or has_table_privilege('zhudatuanidentityapi','organization.membernoderegistration','select,insert,update,delete')
    or has_table_privilege('zhudatuanidentityapi','organization.node','select,insert,update,delete')
    or has_table_privilege('zhudatuanidentityapi','organization.noderelation','select,insert,update,delete') then
    raise exception 'STOREFRONT_MEMBER_NODE_PROJECTION_CONTRACT_INVALID';
  end if;
end
$assert$;

commit;
