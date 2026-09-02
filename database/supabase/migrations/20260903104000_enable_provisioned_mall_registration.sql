begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:enable-provisioned-mall-registration:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260903103000'
        and checksum='d06eb0a303bcba4f532e7c362b12850dc5ac25634d2c6163b1bd5454dd0369d7')
    or exists(select 1 from runtime.schemaversion where version>'20260903103000') then
    raise exception 'PROVISIONED_MALL_REGISTRATION_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

-- Every provisioned Mall owns an independent storefront role. The original
-- production Mall keeps its historical role identifier unchanged.
insert into access.role(id,scope_id,name,status,version)
select 'role-zhudatuan-storefront-member:'||owner.organization_id,
  owner.organization_id,'商城会员','active',1
from access.mallowner owner
on conflict(id) do update
set scope_id=excluded.scope_id,name=excluded.name,status='active',version=access.role.version+1;

insert into access.rolepermission(role_id,permission_id,effect)
select 'role-zhudatuan-storefront-member:'||owner.organization_id,
  mapping.permission_id,mapping.effect
from access.mallowner owner
join access.rolepermission mapping on mapping.role_id='role-zhudatuan-storefront-member'
on conflict do nothing;

create or replace function access.provision_mall_owner(
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

  insert into access.role(id,scope_id,name,status,version)
  values('role-zhudatuan-storefront-member:'||p_organization,p_organization,'商城会员','active',1);
  insert into access.rolepermission(role_id,permission_id,effect)
  select 'role-zhudatuan-storefront-member:'||p_organization,mapping.permission_id,mapping.effect
  from access.rolepermission mapping where mapping.role_id='role-zhudatuan-storefront-member';

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

revoke all on function access.provision_mall_owner(text,text,text,text,text,text) from public;
grant execute on function access.provision_mall_owner(text,text,text,text,text,text) to zhudatuanprovisioningapi;

create or replace function access.protect_zhudatuan_registration_access_write()
returns trigger language plpgsql security definer
set search_path=pg_catalog,pg_temp
set row_security=off as $function$
declare
  candidate_membership access.membership%rowtype;
  candidate_principal text;
  candidate_subject_hash text;
  candidate_invitation_role text;
  registration_challenge_allowed boolean := false;
  registration_allowed boolean := false;
begin
  if session_user<>'zhudatuanidentityapi'
    and coalesce(current_setting('role',true),'')<>'zhudatuanidentityapi'
  then return new; end if;

  if tg_table_name='membership' then
    candidate_membership := new;
  else
    select membership.* into candidate_membership
    from access.membership membership where membership.id=new.membership_id;
    if not found then raise exception 'ZHUDATUAN_REGISTRATION_MEMBERSHIP_REQUIRED'; end if;
  end if;

  select profile.principal_id,credential.subject_hash,
    (
      select invite.role_id
      from member.invite invite
      where invite.status='active' and invite.max_uses=1 and invite.use_count=invite.max_uses
        and invite.accepted_at>=transaction_timestamp()
        and (
          (invite.target_client='storefront'
            and invite.role_id=case when invite.organization_id='mall-zhudatuan'
              then 'role-zhudatuan-storefront-member'
              else 'role-zhudatuan-storefront-member:'||invite.organization_id end
            and invite.organization_id=candidate_membership.organization_id
            and candidate_membership.client='storefront')
          or (invite.target_client='operator'
            and (invite.role_id='role-zhudatuan-pending-operator'
              or invite.role_id='role-senior-administrator-v1:'||invite.organization_id)
            and invite.organization_id='tenant-zhudatuan'
            and invite.storefront_organization_id='mall-zhudatuan'
            and invite.allowed_destination_hash=credential.subject_hash
            and (
              (candidate_membership.client='storefront'
                and candidate_membership.organization_id=invite.storefront_organization_id)
              or (candidate_membership.client='operator'
                and candidate_membership.organization_id=invite.organization_id)
            ))
        )
      order by invite.accepted_at desc,invite.id
      limit 1
    ),
    exists(
      select 1 from identity.challenge challenge
      where challenge.purpose='registration'
        and challenge.destination_hash=credential.subject_hash
        and challenge.consumed_at>=transaction_timestamp()
    )
  into candidate_principal,candidate_subject_hash,candidate_invitation_role,registration_challenge_allowed
  from member.profile profile
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  join identity.credential credential on credential.principal_id=principal.id
    and credential.provider='password' and credential.status='active'
    and credential.created_at>=transaction_timestamp()
  where profile.id=candidate_membership.member_id and profile.status='active'
    and profile.mobile_ciphertext is not null and profile.mobile_token is not null
    and profile.created_at>=transaction_timestamp();

  registration_allowed := candidate_invitation_role is not null
    and coalesce(registration_challenge_allowed,false);
  if candidate_subject_hash is null
    or candidate_membership.status<>'active' or candidate_membership.access_version<>1
    or candidate_membership.joined_at is null or candidate_membership.left_at is not null
    or candidate_membership.employee_no is not null or not registration_allowed
  then raise exception 'ZHUDATUAN_REGISTRATION_MEMBERSHIP_BOUNDARY_INVALID'; end if;

  if tg_table_name='membershiprole' then
    if new.expires_at is not null or new.delegated_by is not null
      or new.effective_at<transaction_timestamp()
      or new.role_id not in('role:self',candidate_invitation_role)
    then raise exception 'ZHUDATUAN_REGISTRATION_ROLE_BOUNDARY_INVALID'; end if;
  elsif tg_table_name='scopegrant' then
    if new.effect<>'allow' or new.expires_at is not null or new.access_version<>1
      or new.effective_at<transaction_timestamp()
      or not (
        (candidate_membership.client='storefront' and (
          (new.scope_kind='mall' and new.scope_id=candidate_membership.organization_id
            and new.scope_path=candidate_membership.organization_id)
          or (new.scope_kind='owner' and new.scope_id=candidate_membership.member_id
            and new.scope_path=candidate_membership.member_id)
          or (new.scope_kind='self' and new.scope_id='self:'||candidate_principal
            and new.scope_path='self:'||candidate_principal)
        ))
        or (candidate_membership.client='operator' and (
          (new.scope_kind='tenant' and new.scope_id='tenant-zhudatuan' and new.scope_path='tenant-zhudatuan')
          or (new.scope_kind='self' and new.scope_id='self:'||candidate_principal
            and new.scope_path='self:'||candidate_principal)
        ))
      )
    then raise exception 'ZHUDATUAN_REGISTRATION_SCOPE_BOUNDARY_INVALID'; end if;
  end if;
  return new;
end
$function$;

revoke all on function access.protect_zhudatuan_registration_access_write()
  from public,shopapp,shopjob,shopread,zhudatuanidentityapi;

drop policy if exists zhudatuanidentityapiinsert on access.membership;
create policy zhudatuanidentityapiinsert on access.membership for insert to zhudatuanidentityapi with check(
  nullif(current_setting('app.membership_id',true),'') is null
  and status='active' and access_version=1 and joined_at is not null and left_at is null and employee_no is null
  and (
    (client='storefront' and exists(select 1 from organization.organization mall
      where mall.id=organization_id and mall.kind='mall' and mall.status='active'))
    or (client='operator' and organization_id='tenant-zhudatuan')
  )
);

drop policy if exists zhudatuanidentityapiinsert on access.membershiprole;
create policy zhudatuanidentityapiinsert on access.membershiprole for insert to zhudatuanidentityapi with check(
  nullif(current_setting('app.membership_id',true),'') is null
  and expires_at is null and delegated_by is null and effective_at>=transaction_timestamp()
  and exists(select 1 from access.membership membership where membership.id=membership_id and (
    role_id='role:self'
    or (membership.client='storefront' and role_id=case when membership.organization_id='mall-zhudatuan'
      then 'role-zhudatuan-storefront-member'
      else 'role-zhudatuan-storefront-member:'||membership.organization_id end
      and exists(select 1 from access.role role where role.id=role_id
        and role.scope_id=membership.organization_id and role.status='active'))
    or (membership.client='operator' and membership.organization_id='tenant-zhudatuan'
      and (role_id='role-zhudatuan-pending-operator'
        or role_id='role-senior-administrator-v1:'||membership.organization_id))
  ))
);

drop policy if exists zhudatuanidentityapiinsert on access.scopegrant;
create policy zhudatuanidentityapiinsert on access.scopegrant for insert to zhudatuanidentityapi with check(
  nullif(current_setting('app.membership_id',true),'') is null
  and effect='allow' and expires_at is null and access_version=1 and effective_at>=transaction_timestamp()
  and exists(select 1 from access.membership membership
    join member.profile profile on profile.id=membership.member_id
    where membership.id=membership_id and (
      (membership.client='storefront'
        and exists(select 1 from organization.organization mall where mall.id=membership.organization_id
          and mall.kind='mall' and mall.status='active') and (
        (scope_kind='mall' and scope_id=membership.organization_id and scope_path=membership.organization_id)
        or (scope_kind='owner' and scope_id=membership.member_id and scope_path=membership.member_id)
        or (scope_kind='self' and scope_id='self:'||profile.principal_id and scope_path='self:'||profile.principal_id)
      ))
      or (membership.client='operator' and membership.organization_id='tenant-zhudatuan' and (
        (scope_kind='tenant' and scope_id='tenant-zhudatuan' and scope_path='tenant-zhudatuan')
        or (scope_kind='self' and scope_id='self:'||profile.principal_id and scope_path='self:'||profile.principal_id)
      ))
    ))
);

drop policy if exists zhudatuanidentityapi on member.invite;
create policy zhudatuanidentityapi on member.invite for select to zhudatuanidentityapi using(
  (
    nullif(current_setting('app.membership_id',true),'') is null
    and status='active' and effective_at<=clock_timestamp() and expires_at>clock_timestamp()
    and (use_count<max_uses or (use_count=max_uses and accepted_at>=transaction_timestamp()))
    and (
      (target_client='storefront'
        and role_id=case when organization_id='mall-zhudatuan' then 'role-zhudatuan-storefront-member'
          else 'role-zhudatuan-storefront-member:'||organization_id end
        and storefront_organization_id is null
        and exists(select 1 from organization.organization mall
          where mall.id=organization_id and mall.kind='mall' and mall.status='active'))
      or (target_client='operator'
        and (role_id='role-zhudatuan-pending-operator'
          or role_id='role-senior-administrator-v1:'||organization_id)
        and organization_id='tenant-zhudatuan' and storefront_organization_id='mall-zhudatuan'
        and allowed_destination_hash is not null and max_uses=1)
    )
  ) or (
    access.zhudatuan_operator_invitation_allowed(role_id,false)
    and target_client='operator' and organization_id='tenant-zhudatuan'
  )
);

drop policy if exists zhudatuanidentityapiupdate on member.invite;
create policy zhudatuanidentityapiupdate on member.invite for update to zhudatuanidentityapi using(
  (
    nullif(current_setting('app.membership_id',true),'') is null
    and status='active' and effective_at<=clock_timestamp() and expires_at>clock_timestamp() and use_count<max_uses
    and (
      (target_client='storefront'
        and role_id=case when organization_id='mall-zhudatuan' then 'role-zhudatuan-storefront-member'
          else 'role-zhudatuan-storefront-member:'||organization_id end
        and storefront_organization_id is null
        and exists(select 1 from organization.organization mall
          where mall.id=organization_id and mall.kind='mall' and mall.status='active'))
      or (target_client='operator'
        and (role_id='role-zhudatuan-pending-operator'
          or role_id='role-senior-administrator-v1:'||organization_id)
        and organization_id='tenant-zhudatuan' and storefront_organization_id='mall-zhudatuan'
        and allowed_destination_hash is not null and max_uses=1)
    )
  ) or (
    access.zhudatuan_operator_invitation_allowed(role_id,false)
    and target_client='operator' and organization_id='tenant-zhudatuan'
  )
) with check(
  (
    nullif(current_setting('app.membership_id',true),'') is null
    and status='active' and use_count<=max_uses
    and (
      (target_client='storefront'
        and role_id=case when organization_id='mall-zhudatuan' then 'role-zhudatuan-storefront-member'
          else 'role-zhudatuan-storefront-member:'||organization_id end
        and storefront_organization_id is null
        and exists(select 1 from organization.organization mall
          where mall.id=organization_id and mall.kind='mall' and mall.status='active'))
      or (target_client='operator'
        and (role_id='role-zhudatuan-pending-operator'
          or role_id='role-senior-administrator-v1:'||organization_id)
        and organization_id='tenant-zhudatuan' and storefront_organization_id='mall-zhudatuan'
        and allowed_destination_hash is not null and max_uses=1)
    )
  ) or (
    access.zhudatuan_operator_invitation_allowed(role_id,false)
    and target_client='operator' and organization_id='tenant-zhudatuan'
    and (role_id='role-zhudatuan-pending-operator'
      or role_id='role-senior-administrator-v1:'||organization_id)
    and storefront_organization_id='mall-zhudatuan'
    and allowed_destination_hash is not null and max_uses=1 and status='disabled'
  )
);

alter policy zhudatuanprovisioningapi on runtime.schemaversion
  using(version in('20260821032000','20260821054000','20260901223000','20260902012000','20260903103000','20260903104000'));

insert into runtime.schemaversion(version,checksum)
values('20260903104000','ce6dddb4d15a527a16593a75b20dd57c985c8a5d424bc7c20a7d9b63ef232601');

do $assert$
begin
  if exists(select 1 from access.mallowner owner
    where not exists(select 1 from access.role role
      where role.id='role-zhudatuan-storefront-member:'||owner.organization_id
        and role.scope_id=owner.organization_id and role.status='active')) then
    raise exception 'PROVISIONED_MALL_STOREFRONT_ROLE_MISSING';
  end if;
  if exists(select 1 from access.mallowner owner
    where (select count(*) from access.rolepermission mapping
        where mapping.role_id='role-zhudatuan-storefront-member:'||owner.organization_id)
      is distinct from
      (select count(*) from access.rolepermission mapping
        where mapping.role_id='role-zhudatuan-storefront-member')) then
    raise exception 'PROVISIONED_MALL_STOREFRONT_PERMISSIONS_INVALID';
  end if;
  if position('role-zhudatuan-storefront-member:' in pg_get_functiondef(
      'access.provision_mall_owner(text,text,text,text,text,text)'::regprocedure))=0
    or position('candidate_membership.organization_id' in pg_get_functiondef(
      'access.protect_zhudatuan_registration_access_write()'::regprocedure))=0 then
    raise exception 'PROVISIONED_MALL_REGISTRATION_FUNCTION_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260903104000'
      and checksum='ce6dddb4d15a527a16593a75b20dd57c985c8a5d424bc7c20a7d9b63ef232601') then
    raise exception 'PROVISIONED_MALL_REGISTRATION_SCHEMA_VERSION_INVALID';
  end if;
end
$assert$;

commit;
