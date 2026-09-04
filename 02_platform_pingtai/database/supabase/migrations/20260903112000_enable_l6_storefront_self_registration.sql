begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:enable-l6-storefront-self-registration:v1'));

do $precondition$
declare definition text;
declare compact text;
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260903111000'
        and checksum='d77bb51609c403a356b5cfd70462441a7b27410f9bab1265c94bb3cdd6567b78')
    or exists(select 1 from runtime.schemaversion where version>'20260903111000') then
    raise exception 'L6_SELF_REGISTRATION_PREDECESSOR_INVALID';
  end if;
  select pg_get_functiondef('access.protect_zhudatuan_registration_access_write()'::regprocedure)
  into definition;
  compact:=regexp_replace(definition,'\s+','','g');
  if position('challenge.consumed_at>=transaction_timestamp()' in compact)=0
    or position('invite.accepted_at>=transaction_timestamp()' in compact)=0
    or position('app.registration_mall_id' in definition)>0 then
    raise exception 'L6_SELF_REGISTRATION_LEGACY_BOUNDARY_INVALID';
  end if;
end
$precondition$;

create or replace function access.protect_zhudatuan_registration_access_write()
returns trigger language plpgsql security definer
set search_path=pg_catalog,pg_temp
set row_security=off as $function$
declare
  candidate_membership access.membership%rowtype;
  candidate_principal text;
  candidate_subject_hash text;
  candidate_registration_role text;
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
    coalesce(
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
      (
        select role.id
        from organization.organization mall
        join access.role role on role.id=case when mall.id='mall-zhudatuan'
          then 'role-zhudatuan-storefront-member'
          else 'role-zhudatuan-storefront-member:'||mall.id end
          and role.scope_id=mall.id and role.status='active'
        where candidate_membership.client='storefront'
          and mall.id=candidate_membership.organization_id
          and mall.id=nullif(current_setting('app.registration_mall_id',true),'')
          and mall.kind='mall' and mall.status='active'
        limit 1
      )
    ),
    exists(
      select 1 from identity.challenge challenge
      where challenge.purpose='registration'
        and challenge.destination_hash=credential.subject_hash
        and challenge.consumed_at>=transaction_timestamp()
    )
  into candidate_principal,candidate_subject_hash,candidate_registration_role,registration_challenge_allowed
  from member.profile profile
  join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  join identity.credential credential on credential.principal_id=principal.id
    and credential.provider='password' and credential.status='active'
  where profile.id=candidate_membership.member_id and profile.status='active'
    and profile.mobile_ciphertext is not null and profile.mobile_token is not null;

  registration_allowed := candidate_registration_role is not null
    and coalesce(registration_challenge_allowed,false);
  if candidate_subject_hash is null
    or candidate_membership.status<>'active' or candidate_membership.access_version<>1
    or candidate_membership.joined_at is null or candidate_membership.left_at is not null
    or candidate_membership.employee_no is not null or not registration_allowed
  then raise exception 'ZHUDATUAN_REGISTRATION_MEMBERSHIP_BOUNDARY_INVALID'; end if;

  if tg_table_name='membershiprole' then
    if new.expires_at is not null or new.delegated_by is not null
      or new.effective_at<transaction_timestamp()
      or new.role_id not in('role:self',candidate_registration_role)
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

insert into runtime.operation(id,owner,method,path,contract_version)
values('identity.storefronts.read','identity','POST','/api/v1/identity/storefronts/resolve','1.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,
  contract_version=excluded.contract_version;

insert into capability.capability(id,kind,name,version,status)
values('identity.storefronts.read','operation','identity.storefronts.read',1,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=excluded.version,status=excluded.status;

insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('identity.storefronts.read','identity.storefronts.read',null,'public')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=null,audience='public';

insert into runtime.schemaversion(version,checksum)
values('20260903112000','ea27f6a86809f8b4b397bf0260d53dc98d6a516ff25d02492ceb8bd3e68f5d80');

do $assert$
declare definition text;
declare compact text;
begin
  select pg_get_functiondef('access.protect_zhudatuan_registration_access_write()'::regprocedure)
  into definition;
  compact:=regexp_replace(definition,'\s+','','g');
  if position('app.registration_mall_id' in definition)=0
    or position('challenge.consumed_at>=transaction_timestamp()' in compact)=0
    or position('invite.accepted_at>=transaction_timestamp()' in compact)=0
    or not exists(select 1 from capability.operation
      where operation_id='identity.storefronts.read'
        and capability_id='identity.storefronts.read'
        and permission_code is null and audience='public')
    or has_function_privilege('zhudatuanidentityapi','access.protect_zhudatuan_registration_access_write()','EXECUTE')
    or not exists(select 1 from runtime.schemaversion
      where version='20260903112000'
        and checksum='ea27f6a86809f8b4b397bf0260d53dc98d6a516ff25d02492ceb8bd3e68f5d80') then
    raise exception 'L6_SELF_REGISTRATION_BOUNDARY_INVALID';
  end if;
end
$assert$;

commit;
