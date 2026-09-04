begin;

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
            and invite.role_id='role-zhudatuan-storefront-member'
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
      or not (
        new.role_id='role:self'
        or (candidate_membership.client='storefront'
          and candidate_membership.organization_id='mall-zhudatuan'
          and new.role_id='role-zhudatuan-storefront-member')
        or (candidate_membership.client='operator'
          and candidate_membership.organization_id='tenant-zhudatuan'
          and new.role_id=candidate_invitation_role)
      )
    then raise exception 'ZHUDATUAN_REGISTRATION_ROLE_BOUNDARY_INVALID'; end if;
  elsif tg_table_name='scopegrant' then
    if new.effect<>'allow' or new.expires_at is not null or new.access_version<>1
      or new.effective_at<transaction_timestamp()
      or not (
        (candidate_membership.client='storefront' and (
          (new.scope_kind='mall' and new.scope_id='mall-zhudatuan' and new.scope_path='mall-zhudatuan')
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
values('20260902138000','1ed7f32a370b825811b8433b5db3302f042d388119afd1c307eed26e47871d2e');

commit;
