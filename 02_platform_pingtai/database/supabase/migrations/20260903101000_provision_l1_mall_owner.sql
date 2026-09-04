begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:provision-l1-mall-owner:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260903100000'
        and checksum='9942a46274ce8717f79b0878ac1deaa590650c0eb0fca29676424b8d0da54c43')
    or exists(select 1 from runtime.schemaversion where version>'20260903100000') then
    raise exception 'PROVISION_L1_MALL_OWNER_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create table access.mallowner(
  mall_id text primary key references organization.organization(id),
  organization_id text not null unique references organization.organization(id),
  scope_id text not null unique,
  membership_id text not null unique references access.membership(id),
  source_membership_id text not null references access.membership(id),
  created_at timestamptz not null
);
alter table access.mallowner enable row level security;

create function access.provision_mall_owner(
  p_source_membership text,
  p_principal text,
  p_owner_membership text,
  p_organization text,
  p_scope text,
  p_mall text
)
returns table(membership_id text,member_id text,principal_id text)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare resolved_member text;
begin
  select profile.id into resolved_member
  from access.membership source
  join member.profile profile on profile.id=source.member_id and profile.status='active'
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  where source.id=p_source_membership and source.client='operator' and source.status='active'
    and profile.principal_id=p_principal;
  if resolved_member is null then raise exception 'MALL_OWNER_SOURCE_INVALID'; end if;

  insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
  values(p_owner_membership,resolved_member,p_organization,'operator','active',1,clock_timestamp());
  insert into access.membershiprole(membership_id,role_id,effective_at)
  values(p_owner_membership,'role:self',clock_timestamp());
  insert into access.scopegrant(
    id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version
  ) values
    ('scope:'||p_owner_membership||':mall',p_owner_membership,'mall',p_scope,p_scope,'allow',clock_timestamp(),1),
    ('scope:'||p_owner_membership||':owner',p_owner_membership,'owner',resolved_member,resolved_member,'allow',clock_timestamp(),1),
    ('scope:'||p_owner_membership||':self',p_owner_membership,'self','self:'||p_principal,
      'self:'||p_principal,'allow',clock_timestamp(),1);
  insert into access.mallowner(mall_id,organization_id,scope_id,membership_id,source_membership_id,created_at)
  values(p_mall,p_organization,p_scope,p_owner_membership,p_source_membership,clock_timestamp());

  return query select p_owner_membership,resolved_member,p_principal;
end
$function$;

create function access.read_provisioned_mall(p_mall text)
returns table(
  organization_id text,
  scope_id text,
  mall_id text,
  parent_id text,
  owner_membership_id text,
  owner_member_id text,
  owner_principal_id text,
  application_id text,
  pool_id text,
  code text,
  public_slug text,
  name text,
  state text,
  publication_state text
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select owner.organization_id,owner.scope_id,owner.mall_id,mall.parent_id,
    owner.membership_id,membership.member_id,profile.principal_id,
    application.id,pool.id,binding.source_code,application.public_slug,mall.name,
    'ready'::text,application.status
  from access.mallowner owner
  join organization.organization mall on mall.id=owner.organization_id
    and mall.kind='mall' and mall.status='active'
  join organization.sourcebinding binding on binding.organization_id=mall.id
    and binding.source_type='mall' and binding.source_id=owner.mall_id
  join access.membership membership on membership.id=owner.membership_id
    and membership.organization_id=owner.organization_id and membership.client='operator' and membership.status='active'
  join member.profile profile on profile.id=membership.member_id and profile.status='active'
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  join experience.binding storefront on storefront.mall_id=owner.mall_id
  join experience.application application on application.id=storefront.application_id
    and application.scope_id=owner.scope_id and application.status='draft'
  join experience.version version on version.id=application.head_version_id
    and version.application_id=application.id and version.validation_state='valid'
  join catalog.poolbinding poolbinding on poolbinding.mall_id=owner.mall_id
    and poolbinding.pool_id=storefront.pool_id and poolbinding.status='active'
  join catalog.pool pool on pool.id=poolbinding.pool_id and pool.scope_id=owner.scope_id and pool.status='active'
  where owner.mall_id=p_mall
$function$;

revoke all on function access.provision_mall_owner(text,text,text,text,text,text) from public;
revoke all on function access.read_provisioned_mall(text) from public;
grant execute on function access.provision_mall_owner(text,text,text,text,text,text),
  access.read_provisioned_mall(text) to zhudatuanprovisioningapi;

insert into runtime.operation(id,owner,method,path,contract_version)
values('provisioning.malls.read','provisioning','GET','/api/v1/provisioning/malls/{mallid}','1.0.0');
insert into capability.capability(id,kind,name,version,status)
values('provisioning.malls.read','operation','provisioning.malls.read',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('provisioning.malls.read','provisioning.malls.read','organization.layer.read','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:provisioning.malls.read',root.id,'provisioning.malls.read','enabled',null,
  '1970-01-01T00:00:00Z',null,0
from organization.organization root
where root.kind='platform' and root.parent_id is null and root.status='active';

alter policy zhudatuanprovisioningapi on runtime.schemaversion
  using(version in('20260821032000','20260821054000','20260901223000','20260902012000','20260903101000'));

insert into runtime.schemaversion(version,checksum)
values('20260903101000','93c46ec2519b7fd7c95e78d5bd64b6a2ec06b66e9c4e381093a426c1371920f5');

do $assert$
begin
  if to_regclass('access.mallowner') is null
    or to_regprocedure('access.provision_mall_owner(text,text,text,text,text,text)') is null
    or to_regprocedure('access.read_provisioned_mall(text)') is null
    or has_function_privilege('public','access.provision_mall_owner(text,text,text,text,text,text)','EXECUTE')
    or has_function_privilege('public','access.read_provisioned_mall(text)','EXECUTE')
    or not has_function_privilege('zhudatuanprovisioningapi','access.provision_mall_owner(text,text,text,text,text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanprovisioningapi','access.read_provisioned_mall(text)','EXECUTE')
    or has_table_privilege('zhudatuanprovisioningapi','access.mallowner','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('zhudatuanprovisioningapi','access.membership','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'PROVISION_L1_MALL_OWNER_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.operation where id='provisioning.malls.read'
      and owner='provisioning' and method='GET' and path='/api/v1/provisioning/malls/{mallid}')
    or not exists(select 1 from capability.operation where operation_id='provisioning.malls.read'
      and permission_code='organization.layer.read' and audience='operator')
    or not exists(select 1 from capability.entitlement entitlement
      join organization.organization root on root.id=entitlement.scope_id
      where entitlement.capability_id='provisioning.malls.read' and entitlement.state='enabled'
        and root.kind='platform' and root.parent_id is null) then
    raise exception 'PROVISION_L1_MALL_READ_CONTRACT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260903101000'
      and checksum='93c46ec2519b7fd7c95e78d5bd64b6a2ec06b66e9c4e381093a426c1371920f5') then
    raise exception 'PROVISION_L1_MALL_OWNER_SCHEMA_VERSION_INVALID';
  end if;
end
$assert$;

commit;
