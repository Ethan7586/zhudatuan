begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:node-mall-operator-invitations:v1'));

do $precondition$
begin
  if to_regprocedure('access.zhudatuan_operator_invitation_allowed(text,boolean)') is null
    or not exists(select 1 from pg_policy where polrelid='member.invite'::regclass
      and polname='zhudatuanidentityapi')
    or not exists(select 1 from pg_policy where polrelid='member.invite'::regclass
      and polname='zhudatuanidentityapiinsert')
    or not exists(select 1 from pg_policy where polrelid='member.invite'::regclass
      and polname='zhudatuanidentityapiupdate') then
    raise exception 'NODE_MALL_OPERATOR_INVITATION_PRECONDITION_INVALID';
  end if;
end
$precondition$;

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
        and organization_id='tenant-zhudatuan' and storefront_organization_id is not null
        and allowed_destination_hash is not null and max_uses=1
        and exists(select 1 from organization.organization storefront
          join organization.unitclosure closure on closure.descendant_id=storefront.id
          where storefront.id=member.invite.storefront_organization_id
            and storefront.kind='mall' and storefront.status='active'
            and closure.ancestor_id=member.invite.organization_id))
    )
  ) or (
    access.zhudatuan_operator_invitation_allowed(role_id,false)
    and target_client='operator' and organization_id='tenant-zhudatuan'
    and (
      created_by=nullif(current_setting('app.membership_id',true),'')
      or accepted_membership_id=nullif(current_setting('app.membership_id',true),'')
      or access.zhudatuan_owner_context()
    )
  )
);

drop policy if exists zhudatuanidentityapiinsert on member.invite;
create policy zhudatuanidentityapiinsert on member.invite for insert to zhudatuanidentityapi with check(
  access.zhudatuan_operator_invitation_allowed(role_id,true)
  and created_by=nullif(current_setting('app.membership_id',true),'')
  and target_client='operator' and organization_id='tenant-zhudatuan'
  and storefront_organization_id is not null and allowed_destination_hash is not null
  and max_uses=1 and use_count=0 and status='active'
  and accepted_at is null and effective_at<=clock_timestamp() and expires_at>clock_timestamp()
  and exists(select 1 from organization.organization storefront
    join organization.unitclosure closure on closure.descendant_id=storefront.id
    where storefront.id=member.invite.storefront_organization_id
      and storefront.kind='mall' and storefront.status='active'
      and closure.ancestor_id=member.invite.organization_id)
  and exists(select 1 from access.role role
    where role.id=member.invite.role_id and role.scope_id=member.invite.organization_id and role.status='active'
      and ((role.id='role-zhudatuan-pending-operator'
          and not exists(select 1 from access.rolepermission mapping where mapping.role_id=role.id))
        or role.id='role-senior-administrator-v1:'||member.invite.organization_id))
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
        and organization_id='tenant-zhudatuan' and storefront_organization_id is not null
        and allowed_destination_hash is not null and max_uses=1
        and exists(select 1 from organization.organization storefront
          join organization.unitclosure closure on closure.descendant_id=storefront.id
          where storefront.id=member.invite.storefront_organization_id
            and storefront.kind='mall' and storefront.status='active'
            and closure.ancestor_id=member.invite.organization_id))
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
        and organization_id='tenant-zhudatuan' and storefront_organization_id is not null
        and allowed_destination_hash is not null and max_uses=1
        and exists(select 1 from organization.organization storefront
          join organization.unitclosure closure on closure.descendant_id=storefront.id
          where storefront.id=member.invite.storefront_organization_id
            and storefront.kind='mall' and storefront.status='active'
            and closure.ancestor_id=member.invite.organization_id))
    )
  ) or (
    access.zhudatuan_operator_invitation_allowed(role_id,false)
    and target_client='operator' and organization_id='tenant-zhudatuan'
    and (role_id='role-zhudatuan-pending-operator'
      or role_id='role-senior-administrator-v1:'||organization_id)
    and storefront_organization_id is not null
    and allowed_destination_hash is not null and max_uses=1 and status='disabled'
    and exists(select 1 from organization.organization storefront
      join organization.unitclosure closure on closure.descendant_id=storefront.id
      where storefront.id=member.invite.storefront_organization_id
        and storefront.kind='mall' and storefront.status='active'
        and closure.ancestor_id=member.invite.organization_id)
  )
);

do $assert$
declare
  policy_name text;
  policy_expression text;
begin
  foreach policy_name in array array[
    'zhudatuanidentityapi','zhudatuanidentityapiinsert','zhudatuanidentityapiupdate'
  ] loop
    select concat_ws(' ',pg_get_expr(policy.polqual,policy.polrelid),
      pg_get_expr(policy.polwithcheck,policy.polrelid)) into policy_expression
    from pg_policy policy
    where policy.polrelid='member.invite'::regclass and policy.polname=policy_name;
    if policy_expression is null
      or policy_expression ~ 'storefront_organization_id[[:space:]]*=[[:space:]]*''mall-zhudatuan'''
      or position('unitclosure' in policy_expression)=0 then
      raise exception 'NODE_MALL_OPERATOR_INVITATION_POLICY_INVALID:%',policy_name;
    end if;
  end loop;
end
$assert$;

commit;
