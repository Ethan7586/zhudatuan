begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:allow-platform-owner-l6-registration:v1'));

do $precondition$
declare owner_guard text; registration_guard text;
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260903112000'
        and checksum='ea27f6a86809f8b4b397bf0260d53dc98d6a516ff25d02492ceb8bd3e68f5d80')
    or exists(select 1 from runtime.schemaversion where version>'20260903112000') then
    raise exception 'PLATFORM_OWNER_L6_REGISTRATION_PREDECESSOR_INVALID';
  end if;
  select pg_get_functiondef('access.protect_zhudatuan_owner()'::regprocedure) into owner_guard;
  select pg_get_functiondef('access.protect_zhudatuan_registration_access_write()'::regprocedure) into registration_guard;
  if position('access.zhudatuan_protected_identity(old.id,old.member_id,null,null)' in owner_guard)=0
    or position('challenge.consumed_at>=transaction_timestamp()' in registration_guard)=0
    or position('app.registration_mall_id' in registration_guard)=0 then
    raise exception 'PLATFORM_OWNER_L6_REGISTRATION_LEGACY_BOUNDARY_INVALID';
  end if;
end
$precondition$;

-- A platform Owner keeps the protected L0 membership intact.  This only permits the
-- separate, self-service storefront membership that is created for an active L1 mall.
create or replace function access.protect_zhudatuan_owner()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $function$
declare protected boolean:=false;
begin
  if tg_table_schema='access' and tg_table_name='role' then
    protected := (tg_op<>'INSERT' and old.id='role-platform-owner-v2')
      or (tg_op<>'DELETE' and new.id='role-platform-owner-v2');
  elsif tg_table_schema='access' and tg_table_name='rolepermission' then
    protected := (tg_op<>'INSERT' and old.role_id='role-platform-owner-v2')
      or (tg_op<>'DELETE' and new.role_id='role-platform-owner-v2');
  elsif tg_table_schema='access' and tg_table_name='membership' then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(old.id,old.member_id,null,null))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(new.id,new.member_id,null,null));
    if tg_op='INSERT' and new.client='storefront'
      and new.organization_id=nullif(current_setting('app.registration_mall_id',true),'')
      and exists(select 1 from organization.organization mall
        where mall.id=new.organization_id and mall.kind='mall' and mall.status='active') then
      protected:=false;
    end if;
  elsif tg_table_schema='access' and tg_table_name='membershiprole' then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(old.membership_id,null,null,null))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(new.membership_id,null,null,null))
      or (tg_op<>'INSERT' and old.role_id='role-platform-owner-v2')
      or (tg_op<>'DELETE' and new.role_id='role-platform-owner-v2');
  elsif tg_table_schema='access' and tg_table_name in('scopegrant','membershipoverride') then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(old.membership_id,null,null,null))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(new.membership_id,null,null,null));
  elsif tg_table_schema='identity' and tg_table_name='principal' then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(null,null,old.id,null))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(null,null,new.id,null));
  elsif tg_table_schema='identity' and tg_table_name='credential' then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(null,null,old.principal_id,old.id))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(null,null,new.principal_id,new.id));
  elsif tg_table_schema='member' and tg_table_name='profile' then
    protected := (tg_op<>'INSERT' and access.zhudatuan_protected_identity(null,old.id,old.principal_id,null))
      or (tg_op<>'DELETE' and access.zhudatuan_protected_identity(null,new.id,new.principal_id,null));
  end if;
  if not coalesce(protected,false) then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if current_user='shopmigration'
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false) then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'ZHUDATUAN_OWNER_PROTECTED';
end
$function$;
revoke all on function access.protect_zhudatuan_owner() from public,shopapp,shopjob,shopread,
  zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;

-- L6 password registration records that its phone proof is deferred to checkout in the
-- transaction-local registration context; every other registration still requires its OTP.
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
  deferred_phone_verification boolean := false;
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

  deferred_phone_verification := candidate_membership.client='storefront'
    and nullif(current_setting('app.registration_phone_verification',true),'')='checkout';
  registration_allowed := candidate_registration_role is not null
    and (coalesce(registration_challenge_allowed,false) or deferred_phone_verification);
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

insert into runtime.schemaversion(version,checksum)
values('20260904010000','4fb39b3499024c958f16a5bf15563c56f44506fd25cf92a3efc645b36c9e1bbb');

do $assert$
declare owner_guard text; registration_guard text; owner_compact text; registration_compact text;
begin
  select pg_get_functiondef('access.protect_zhudatuan_owner()'::regprocedure) into owner_guard;
  select pg_get_functiondef('access.protect_zhudatuan_registration_access_write()'::regprocedure) into registration_guard;
  owner_compact:=regexp_replace(owner_guard,'\s+','','g');
  registration_compact:=regexp_replace(registration_guard,'\s+','','g');
  if position('new.organization_id=nullif(current_setting(''app.registration_mall_id'',true),'''')' in owner_compact)=0
    or position('deferred_phone_verification' in registration_compact)=0
    or position('current_setting(''app.registration_phone_verification'',true)' in registration_compact)=0
    or not exists(select 1 from runtime.schemaversion
      where version='20260904010000'
        and checksum='4fb39b3499024c958f16a5bf15563c56f44506fd25cf92a3efc645b36c9e1bbb') then
    raise exception 'PLATFORM_OWNER_L6_REGISTRATION_BOUNDARY_INVALID';
  end if;
end
$assert$;

commit;
