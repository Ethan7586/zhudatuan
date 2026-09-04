begin;

alter table member.invite drop constraint member_invite_operator_boundary;
alter table member.invite add constraint member_invite_operator_boundary check(
  (target_client='storefront' and storefront_organization_id is null)
  or (target_client='operator'
    and (role_id='role-zhudatuan-pending-operator'
      or role_id='role-senior-administrator-v1:'||organization_id)
    and storefront_organization_id is not null
    and allowed_destination_hash is not null
    and max_uses=1)
);

create or replace function access.zhudatuan_operator_invitation_allowed(
  p_role_id text,
  p_create boolean
)
returns boolean language sql stable
set search_path=pg_catalog,pg_temp as $function$
  select current_user in('shopapp','zhudatuanidentityapi')
    and governance.scope_kind='tenant'
    and governance.scope_semantic_id=governance.organization_id
    and (p_role_id='role-zhudatuan-pending-operator'
      or p_role_id='role-senior-administrator-v1:'||governance.organization_id)
    and (governance.is_exact_owner or governance.governance_level='senior_administrator')
    and (not p_create or governance.is_exact_owner
      or p_role_id='role-zhudatuan-pending-operator')
    and exists(
      select 1 from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id=case when governance.is_exact_owner then 'role-platform-owner-v2'
          else 'role-senior-administrator-v1:'||governance.organization_id end
        and mapping.effect='allow'
        and permission.code='identity.invitation.manage'
        and permission.status='active'
        and not exists(
          select 1 from access.membershipoverride denied
          where denied.membership_id=governance.actor_membership_id
            and denied.permission_id=permission.id
            and denied.effect='deny'
            and denied.revoked_at is null
            and denied.effective_at<=governance.resolved_at
            and (denied.expires_at is null or denied.expires_at>governance.resolved_at)
        )
    )
  from access.resolve_governance(
    nullif(current_setting('app.membership_id',true),''),
    nullif(current_setting('app.actor_id',true),''),
    null,
    nullif(current_setting('app.scope_id',true),'')
  ) governance
$function$;
revoke all on function access.zhudatuan_operator_invitation_allowed(text,boolean)
  from public,shopjob,shopread,zhudatuanidentityjob;
grant execute on function access.zhudatuan_operator_invitation_allowed(text,boolean)
  to shopapp,zhudatuanidentityapi;

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
      or new.role_id not in('role:self',candidate_invitation_role)
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

create or replace function member.protect_zhudatuan_invite_update()
returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
declare
  authenticated boolean := nullif(current_setting('app.membership_id',true),'') is not null;
  authorization_scope text := nullif(current_setting('app.scope_id',true),'');
  management_allowed boolean := false;
begin
  if current_user not in('shopapp','zhudatuanidentityapi') then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then raise exception 'ZHUDATUAN_INVITATION_DELETE_BOUNDARY_INVALID'; end if;
  if tg_op='INSERT' then
    if not authenticated then raise exception 'ZHUDATUAN_INVITATION_CREATE_BOUNDARY_INVALID'; end if;
    if new.target_client='operator' then
      management_allowed := new.organization_id='tenant-zhudatuan'
        and authorization_scope=new.organization_id
        and access.zhudatuan_operator_invitation_allowed(new.role_id,true)
        and new.created_by=nullif(current_setting('app.membership_id',true),'')
        and new.storefront_organization_id is not null
        and new.allowed_destination_hash is not null and new.max_uses=1
        and exists(select 1 from access.role role
          where role.id=new.role_id and role.scope_id=new.organization_id and role.status='active'
            and ((role.id='role-zhudatuan-pending-operator'
                and not exists(select 1 from access.rolepermission mapping where mapping.role_id=role.id))
              or role.id='role-senior-administrator-v1:'||new.organization_id));
    else
      management_allowed := current_user='shopapp'
        and authorization_scope=new.organization_id
        and new.created_by=nullif(current_setting('app.membership_id',true),'')
        and new.role_id='role-zhudatuan-storefront-member'
        and new.storefront_organization_id is null and new.allowed_destination_hash is null
        and exists(select 1 from organization.organization scope
          where scope.id=authorization_scope and scope.kind='mall' and scope.status='active')
        and exists(select 1 from access.role role
          where role.id=new.role_id and role.scope_id=authorization_scope and role.status='active')
        and exists(
          select 1 from access.resolve_membership(nullif(current_setting('app.membership_id',true),'')) resolved
          cross join lateral jsonb_array_elements(resolved.grants) grantrow
          where resolved.active and not ('identity.invitation.manage'=any(resolved.denies))
            and grantrow->'scope'->>'id'=authorization_scope
            and (grantrow->'permissions') ? 'identity.invitation.manage'
        );
    end if;
    if not management_allowed or new.status<>'active' or new.use_count<>0 or new.accepted_at is not null
      or new.version<>0 or new.effective_at>clock_timestamp() or new.expires_at<=clock_timestamp()
    then raise exception 'ZHUDATUAN_INVITATION_CREATE_BOUNDARY_INVALID'; end if;
    return new;
  end if;
  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.label is distinct from old.label
    or new.destination_hash is distinct from old.destination_hash
    or new.token_hash is distinct from old.token_hash
    or new.expires_at is distinct from old.expires_at
    or new.created_by is distinct from old.created_by
    or new.role_id is distinct from old.role_id
    or new.allowed_destination_hash is distinct from old.allowed_destination_hash
    or new.max_uses is distinct from old.max_uses
    or new.effective_at is distinct from old.effective_at
    or new.created_at is distinct from old.created_at
    or new.registration_policy_id is distinct from old.registration_policy_id
    or new.terms_hash is distinct from old.terms_hash
    or new.target_client is distinct from old.target_client
    or new.storefront_organization_id is distinct from old.storefront_organization_id
  then raise exception 'ZHUDATUAN_INVITATION_IMMUTABLE_BOUNDARY_INVALID'; end if;

  if authenticated then
    if old.target_client='operator' then
      management_allowed := old.organization_id='tenant-zhudatuan'
        and authorization_scope=old.organization_id
        and access.zhudatuan_operator_invitation_allowed(old.role_id,false);
    elsif current_user='zhudatuanidentityapi' then
      management_allowed := false;
    else
      management_allowed := authorization_scope is not null and exists(
          select 1 from access.membership membership
          join access.scopegrant scopegrant on scopegrant.membership_id=membership.id
            and scopegrant.effect='allow' and scopegrant.access_version>0
            and scopegrant.access_version<=membership.access_version
            and scopegrant.effective_at<=clock_timestamp()
            and (scopegrant.expires_at is null or scopegrant.expires_at>clock_timestamp())
          where membership.id=nullif(current_setting('app.membership_id',true),'')
            and membership.status='active'
            and (authorization_scope=old.organization_id or exists(
              select 1 from organization.unitclosure closure
              where closure.ancestor_id=authorization_scope and closure.descendant_id=old.organization_id))
            and (scopegrant.scope_id=authorization_scope or exists(
              select 1 from organization.unitclosure closure
              where closure.ancestor_id=scopegrant.scope_id and closure.descendant_id=authorization_scope))
            and (scopegrant.scope_id=old.organization_id or exists(
              select 1 from organization.unitclosure closure
              where closure.ancestor_id=scopegrant.scope_id and closure.descendant_id=old.organization_id))
            and (
              exists(
                select 1 from access.membershiprole assignment
                join access.role role on role.id=assignment.role_id and role.status='active'
                join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='allow'
                join access.permission permission on permission.id=mapping.permission_id
                  and permission.code='identity.invitation.manage' and permission.status='active'
                where assignment.membership_id=membership.id
                  and assignment.effective_at<=clock_timestamp()
                  and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
                  and (role.scope_id=membership.organization_id or exists(
                    select 1 from organization.unitclosure closure
                    where closure.ancestor_id=role.scope_id and closure.descendant_id=membership.organization_id))
                  and (role.scope_id=authorization_scope or exists(
                    select 1 from organization.unitclosure closure
                    where closure.ancestor_id=role.scope_id and closure.descendant_id=authorization_scope))
                  and (role.scope_id=old.organization_id or exists(
                    select 1 from organization.unitclosure closure
                    where closure.ancestor_id=role.scope_id and closure.descendant_id=old.organization_id))
              ) or exists(
                select 1 from access.membershipoverride overridepermission
                join access.permission permission on permission.id=overridepermission.permission_id
                  and permission.code='identity.invitation.manage' and permission.status='active'
                where overridepermission.membership_id=membership.id and overridepermission.effect='allow'
                  and overridepermission.revoked_at is null
                  and overridepermission.effective_at<=clock_timestamp()
                  and (overridepermission.expires_at is null or overridepermission.expires_at>clock_timestamp())
              )
            )
        )
        and not exists(
          select 1 from access.membershiprole assignment
          join access.membership membership on membership.id=assignment.membership_id and membership.status='active'
          join access.role role on role.id=assignment.role_id and role.status='active'
          join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='deny'
          join access.permission permission on permission.id=mapping.permission_id
            and permission.code='identity.invitation.manage' and permission.status='active'
          where assignment.membership_id=nullif(current_setting('app.membership_id',true),'')
            and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
            and (role.scope_id=membership.organization_id or exists(
              select 1 from organization.unitclosure closure
              where closure.ancestor_id=role.scope_id and closure.descendant_id=membership.organization_id))
        )
        and not exists(
          select 1 from access.membershipoverride denied
          join access.permission permission on permission.id=denied.permission_id
            and permission.code='identity.invitation.manage' and permission.status='active'
          where denied.membership_id=nullif(current_setting('app.membership_id',true),'')
            and denied.effect='deny' and denied.revoked_at is null
            and denied.effective_at<=clock_timestamp()
            and (denied.expires_at is null or denied.expires_at>clock_timestamp())
        );
    end if;
    if not management_allowed or old.status<>'active' or new.status<>'disabled'
      or new.use_count<>old.use_count or new.accepted_at is distinct from old.accepted_at
      or new.version<>old.version+1
    then raise exception 'ZHUDATUAN_INVITATION_REVOKE_BOUNDARY_INVALID'; end if;
  else
    if old.status<>'active' or new.status<>old.status
      or new.use_count<>old.use_count+1 or new.use_count>new.max_uses
      or new.version<>old.version+1
      or (new.use_count<new.max_uses and new.accepted_at is distinct from old.accepted_at)
      or (new.use_count=new.max_uses and (new.accepted_at is null
        or new.accepted_at<transaction_timestamp() or new.accepted_at>clock_timestamp()))
    then raise exception 'ZHUDATUAN_INVITATION_CONSUME_BOUNDARY_INVALID'; end if;
  end if;
  return new;
end
$function$;
revoke all on function member.protect_zhudatuan_invite_update()
  from public,shopapp,shopjob,shopread,zhudatuanidentityapi;

drop policy if exists zhudatuanidentityapiinsert on access.membershiprole;
create policy zhudatuanidentityapiinsert on access.membershiprole for insert to zhudatuanidentityapi with check(
  nullif(current_setting('app.membership_id',true),'') is null
  and expires_at is null and delegated_by is null and effective_at>=transaction_timestamp()
  and exists(select 1 from access.membership membership where membership.id=membership_id and (
    role_id='role:self'
    or (membership.client='storefront' and membership.organization_id='mall-zhudatuan'
      and role_id='role-zhudatuan-storefront-member')
    or (membership.client='operator' and membership.organization_id='tenant-zhudatuan'
      and (role_id='role-zhudatuan-pending-operator'
        or role_id='role-senior-administrator-v1:'||membership.organization_id))
  ))
);

drop policy if exists zhudatuanidentityapi on member.invite;
drop policy if exists zhudatuanidentityapiinsert on member.invite;
drop policy if exists zhudatuanidentityapiupdate on member.invite;

create policy zhudatuanidentityapi on member.invite for select to zhudatuanidentityapi using(
  (
    nullif(current_setting('app.membership_id',true),'') is null
    and status='active' and effective_at<=clock_timestamp() and expires_at>clock_timestamp()
    and (use_count<max_uses or (use_count=max_uses and accepted_at>=transaction_timestamp()))
    and (
      (target_client='storefront' and role_id='role-zhudatuan-storefront-member'
        and organization_id='mall-zhudatuan' and storefront_organization_id is null)
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

create policy zhudatuanidentityapiinsert on member.invite for insert to zhudatuanidentityapi with check(
  access.zhudatuan_operator_invitation_allowed(role_id,true)
  and created_by=nullif(current_setting('app.membership_id',true),'')
  and target_client='operator' and organization_id='tenant-zhudatuan'
  and storefront_organization_id='mall-zhudatuan' and allowed_destination_hash is not null
  and max_uses=1 and use_count=0 and status='active'
  and accepted_at is null and effective_at<=clock_timestamp() and expires_at>clock_timestamp()
  and exists(select 1 from organization.organization storefront
    join organization.unitclosure closure on closure.descendant_id=storefront.id
    where storefront.id=member.invite.storefront_organization_id and storefront.kind='mall' and storefront.status='active'
      and closure.ancestor_id=member.invite.organization_id)
  and exists(select 1 from access.role role
    where role.id=member.invite.role_id and role.scope_id=member.invite.organization_id and role.status='active'
      and ((role.id='role-zhudatuan-pending-operator'
          and not exists(select 1 from access.rolepermission mapping where mapping.role_id=role.id))
        or role.id='role-senior-administrator-v1:'||member.invite.organization_id))
);

create policy zhudatuanidentityapiupdate on member.invite for update to zhudatuanidentityapi using(
  (
    nullif(current_setting('app.membership_id',true),'') is null
    and status='active' and effective_at<=clock_timestamp() and expires_at>clock_timestamp() and use_count<max_uses
    and (
      (target_client='storefront' and role_id='role-zhudatuan-storefront-member'
        and organization_id='mall-zhudatuan' and storefront_organization_id is null)
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
      (target_client='storefront' and role_id='role-zhudatuan-storefront-member'
        and organization_id='mall-zhudatuan' and storefront_organization_id is null)
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

insert into runtime.schemaversion(version,checksum)
values('20260902136000','25bb76e927ff030bd4eb7e2a99bf38196495fe82b32db52d6017ca8d7d75e4af');

commit;
