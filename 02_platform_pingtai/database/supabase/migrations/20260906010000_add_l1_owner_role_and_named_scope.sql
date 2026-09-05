begin;

insert into access.role(id, scope_id, name, status, version)
values('role-l1-owner-v1:tenant-zhudatuan', 'tenant-zhudatuan', 'L1 Owner', 'active', 1)
on conflict (id) do nothing;

insert into access.rolepermission(role_id, permission_id, effect)
select 'role-l1-owner-v1:tenant-zhudatuan', mapping.permission_id, mapping.effect
from access.rolepermission mapping
join access.permission permission on permission.id = mapping.permission_id
where mapping.role_id = 'role-platform-owner-v2'
  and mapping.effect = 'allow'
  and permission.code not like 'access.ownership.%'
on conflict do nothing;

create or replace function access.scope_object(p_scope_id text) returns jsonb
language plpgsql stable security definer
set search_path = organization, partner, member, pg_temp
as $$
declare value jsonb;
begin
  select jsonb_strip_nulls(jsonb_build_object(
      'kind',scope.kind,'id',scope.id,'name',scope.name,
      'tenant',(select ancestor.id from organization.unitclosure closure join organization.organization ancestor on ancestor.id=closure.ancestor_id where closure.descendant_id=scope.id and ancestor.kind='tenant' limit 1),
      'path',coalesce((select jsonb_agg(jsonb_build_object('kind',ancestor.kind,'id',ancestor.id) order by closure.depth desc)
        from organization.unitclosure closure join organization.organization ancestor on ancestor.id=closure.ancestor_id
        where closure.descendant_id=scope.id and closure.depth>0),'[]'::jsonb))) into value
    from organization.organization scope where scope.id=p_scope_id;
  if value is not null then return value; end if;
  select jsonb_strip_nulls(jsonb_build_object('kind',subject.kind,'id',subject.id,'tenant',tenant.id,'path',
      coalesce((select jsonb_agg(jsonb_build_object('kind',ancestor.kind,'id',ancestor.id) order by closure.depth desc)
        from organization.unitclosure closure join organization.organization ancestor on ancestor.id=closure.ancestor_id
        where closure.descendant_id=subject.scope_id),'[]'::jsonb))) into value
    from partner.partner subject
    left join organization.unitclosure tenantclosure on tenantclosure.descendant_id=subject.scope_id
    left join organization.organization tenant on tenant.id=tenantclosure.ancestor_id and tenant.kind='tenant'
    where subject.id=p_scope_id order by tenantclosure.depth asc limit 1;
  if value is not null then return value; end if;
  select jsonb_build_object('kind','owner','id',profile.id,'path','[]'::jsonb) into value from member.profile profile where profile.id=p_scope_id;
  if value is not null then return value; end if;
  if p_scope_id like 'self:%' then return jsonb_build_object('kind','self','id',substr(p_scope_id,6),'path','[]'::jsonb); end if;
  return null;
end
$$;

create or replace function access.provision_mall_owner(
  p_source_membership text,
  p_principal text,
  p_owner_membership text,
  p_organization text,
  p_scope text,
  p_mall text
) returns table(membership_id text, member_id text, principal_id text)
language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare resolved_member text;
begin
  select profile.id into resolved_member
  from access.membership source
  join member.profile profile on profile.id=source.member_id and profile.status='active'
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  where source.id=p_source_membership and source.client='operator' and source.status='active'
    and profile.principal_id=p_principal;
  if resolved_member is null then raise exception 'MALL_OWNER_SOURCE_INVALID'; end if;

  insert into access.role(id,scope_id,name,status,version)
  values('role-zhudatuan-storefront-member:'||p_organization,p_organization,'商城会员','active',1);
  insert into access.rolepermission(role_id,permission_id,effect)
  select 'role-zhudatuan-storefront-member:'||p_organization,mapping.permission_id,mapping.effect
  from access.rolepermission mapping where mapping.role_id='role-zhudatuan-storefront-member';

  insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
  values(p_owner_membership,resolved_member,p_organization,'operator','active',1,clock_timestamp());
  insert into access.membershiprole(
    membership_id,role_id,effective_at,assigned_scope_kind,assigned_scope_id,assigned_scope_path,scope_source
  ) values
    (p_owner_membership,'role:self',clock_timestamp(),null,null,null,null),
    (p_owner_membership,'role-l1-owner-v1:tenant-zhudatuan',clock_timestamp(),'mall',p_scope,p_scope,'l1_owner');
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
$$;

insert into access.membershiprole(
  membership_id,role_id,effective_at,delegated_by,
  assigned_scope_kind,assigned_scope_id,assigned_scope_path,scope_source
)
select owner.membership_id,'role-l1-owner-v1:tenant-zhudatuan',clock_timestamp(),
  'l1-owner-backfill','mall',owner.scope_id,owner.scope_id,'l1_owner'
from access.mallowner owner
join access.membership membership on membership.id=owner.membership_id and membership.status='active'
where exists(
  select 1 from organization.unitclosure closure
  where closure.ancestor_id='tenant-zhudatuan' and closure.descendant_id=owner.organization_id
)
and not exists(
  select 1 from access.membershiprole assignment
  where assignment.membership_id=owner.membership_id
    and assignment.role_id='role-l1-owner-v1:tenant-zhudatuan'
    and assignment.effective_at<=clock_timestamp()
    and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
);

update access.membership membership
set access_version=access_version+1
where membership.status='active'
  and exists(
    select 1 from access.mallowner owner
    where owner.membership_id=membership.id
      and exists(
        select 1 from organization.unitclosure closure
        where closure.ancestor_id='tenant-zhudatuan' and closure.descendant_id=owner.organization_id
      )
  );

commit;
