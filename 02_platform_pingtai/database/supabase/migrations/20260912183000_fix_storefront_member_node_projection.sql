begin;

select pg_advisory_xact_lock(hashtext('identity:storefront-member-node-projection:v2'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='zhudatuanroot')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'STOREFRONT_MEMBER_NODE_PROJECTION_V2_DATABASE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260912182000'
      and checksum='b39dbc952e29463840d9d706edacf43a83418ad33a26640be184c56764e2c62a')
    or exists(select 1 from runtime.schemaversion where version>'20260912182000') then
    raise exception 'STOREFRONT_MEMBER_NODE_PROJECTION_V2_PREDECESSOR_INVALID';
  end if;
  if to_regprocedure('identity.resolve_storefront_member_node(text,text)') is null
    or to_regrole('zhudatuanidentityapi') is null then
    raise exception 'STOREFRONT_MEMBER_NODE_PROJECTION_V2_DEPENDENCY_MISSING';
  end if;
end
$precondition$;

create or replace function identity.resolve_storefront_member_node(
  p_membership_id text,p_organization_id text
)
returns table(
  membership_id text,node_id text,parent_node_id text,signed_level text,node_profile text
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select membership.id,member_node.node_id,member_node.parent_node_id,
    coalesce(member_node.signed_level,'L6'),coalesce(member_node.node_profile,'consumer')
  from access.membership membership
  left join lateral (
    select node.id node_id,relation.parent_node_id,relation.signed_level,node.node_profile
    from organization.membernoderegistration registration
    join organization.node node on node.id=registration.node_id and node.status='active'
    join organization.noderelation relation on relation.node_id=node.id and relation.superseded_at is null
    where registration.membership_id=membership.id
    order by registration.created_at desc,registration.registration_id desc
    limit 1
  ) member_node on true
  where membership.id=p_membership_id and membership.organization_id=p_organization_id
    and membership.client='storefront'
$function$;

alter function identity.resolve_storefront_member_node(text,text) owner to zhudatuanroot;
revoke all on function identity.resolve_storefront_member_node(text,text) from public;
grant execute on function identity.resolve_storefront_member_node(text,text) to zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260912183000','5a0898042359b3da78fe3b99d6a9e0e2b615a071309f5a3678df5d429e953fc4');

insert into supabase_migrations.schema_migrations(version,statements,name)
values('20260912183000',array[]::text[],'20260912183000_fix_storefront_member_node_projection.sql');

do $assert$
begin
  if not exists(select 1 from pg_proc function join pg_roles owner on owner.oid=function.proowner
      where function.oid='identity.resolve_storefront_member_node(text,text)'::regprocedure
        and function.prosecdef and owner.rolname='zhudatuanroot')
    or has_function_privilege('public','identity.resolve_storefront_member_node(text,text)','execute')
    or not has_function_privilege('zhudatuanidentityapi','identity.resolve_storefront_member_node(text,text)','execute')
    or has_table_privilege('zhudatuanidentityapi','organization.membernoderegistration','select,insert,update,delete')
    or has_table_privilege('zhudatuanidentityapi','organization.node','select,insert,update,delete')
    or has_table_privilege('zhudatuanidentityapi','organization.noderelation','select,insert,update,delete') then
    raise exception 'STOREFRONT_MEMBER_NODE_PROJECTION_V2_CONTRACT_INVALID';
  end if;
end
$assert$;

commit;
