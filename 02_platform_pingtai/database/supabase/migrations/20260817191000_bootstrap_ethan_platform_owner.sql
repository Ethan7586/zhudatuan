-- Bootstrap the approved formal platform Owner from the existing local
-- username "ethan". The prior test Owner remains untouched as a rollback
-- identity until an operator verifies Ethan's first successful admin login.
-- This migration never changes credentials or exposes a password.

do $$
declare
  v_member_id text;
  v_user_id text;
  v_tenant_id text;
  v_enterprise_id text;
  v_mall_id text;
  v_platform_id text;
  v_owner_role_id text;
  v_existing_admin_membership_id text;
  v_owner_membership_id constant text := 'membership-platform-owner-ethan-v1';
begin
  select member.id, member.user_id, user_row.tenant_id, user_row.enterprise_id
    into v_member_id, v_user_id, v_tenant_id, v_enterprise_id
  from public.member_login_aliases alias
  join public.members member on member.id = alias.member_id
  join public.users user_row on user_row.id = member.user_id
  where alias.provider = 'local_username'
    and alias.subject = 'ethan'
    and member.status = 'active'
    and user_row.status = 'active';

  if v_member_id is null or v_user_id is null then
    raise exception 'ETHAN_ACTIVE_LOCAL_IDENTITY_NOT_FOUND';
  end if;

  select role.id into v_owner_role_id
  from public.roles role
  where role.tenant_id = v_tenant_id
    and role.code = 'platform_owner'
    and role.is_owner
    and role.status = 'active';

  if v_owner_role_id is null then
    raise exception 'PLATFORM_OWNER_ROLE_NOT_FOUND';
  end if;

  select mall.id into v_mall_id
  from public.malls mall
  where mall.tenant_id = v_tenant_id
    and mall.enterprise_id = v_enterprise_id
    and mall.status = 'active'
  order by mall.id
  limit 1;

  if v_mall_id is null then
    raise exception 'ETHAN_ADMIN_MALL_CONTEXT_NOT_FOUND';
  end if;

  -- Reuse the real platform scope already assigned to an active platform
  -- Owner in this tenant. This is safer than reconstructing a hierarchy
  -- predicate, which can vary between installed production migrations.
  v_platform_id := (
    select scope.resource_id
    from public.membership_scopes scope
    join public.memberships owner_membership
      on owner_membership.id = scope.membership_id
    join public.membership_roles owner_membership_role
      on owner_membership_role.membership_id = owner_membership.id
     and owner_membership_role.revoked_at is null
    join public.roles owner_role
      on owner_role.id = owner_membership_role.role_id
    where owner_membership.tenant_id = v_tenant_id
      and owner_membership.target = 'admin'
      and owner_membership.status = 'active'
      and owner_role.code = 'platform_owner'
      and owner_role.is_owner
      and owner_role.status = 'active'
      and scope.scope_kind = 'platform'
    order by owner_membership.created_at, scope.created_at
    limit 1
  );

  if v_platform_id is null then
    raise exception 'PLATFORM_SCOPE_NOT_FOUND';
  end if;

  select membership.id into v_existing_admin_membership_id
  from public.memberships membership
  where membership.member_id = v_member_id
    and membership.target = 'admin'
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  if v_existing_admin_membership_id is not null
     and v_existing_admin_membership_id <> v_owner_membership_id then
    raise exception 'ETHAN_ACTIVE_ADMIN_MEMBERSHIP_ALREADY_EXISTS:%', v_existing_admin_membership_id;
  end if;

  if exists (
    select 1
    from public.membership_roles membership_role
    where membership_role.membership_id = v_owner_membership_id
      and membership_role.role_id = v_owner_role_id
      and membership_role.revoked_at is null
  ) then
    return;
  end if;

  insert into public.memberships (
    id, member_id, context_user_id, tenant_id, enterprise_id, mall_id, target, status
  ) values (
    v_owner_membership_id, v_member_id, v_user_id, v_tenant_id, v_enterprise_id, v_mall_id, 'admin', 'active'
  )
  on conflict (id) do nothing;

  -- Owner grants and platform scopes cannot be made through routine UI/RPC
  -- paths. Disable only their two guards for this transactional bootstrap;
  -- both are restored before the immutable audit record is written. Any
  -- statement failure rolls the transaction (and trigger state) back.
  alter table public.membership_roles disable trigger membership_roles_protect_owner;
  insert into public.membership_roles (
    membership_id, role_id, granted_by_membership_id, granted_at, expires_at, revoked_at
  ) values (
    v_owner_membership_id, v_owner_role_id, null, now(), null, null
  )
  on conflict (membership_id, role_id) do update
    set granted_at = excluded.granted_at,
        granted_by_membership_id = null,
        expires_at = null,
        revoked_at = null;
  alter table public.membership_roles enable trigger membership_roles_protect_owner;

  alter table public.membership_scopes disable trigger membership_scopes_validate;
  insert into public.membership_scopes (membership_id, scope_kind, resource_id)
  values
    (v_owner_membership_id, 'platform', v_platform_id),
    (v_owner_membership_id, 'tenant', v_tenant_id)
  on conflict do nothing;
  alter table public.membership_scopes enable trigger membership_scopes_validate;

  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json
  ) values (
    gen_random_uuid()::text, v_tenant_id, v_enterprise_id, v_mall_id, v_user_id, 'system',
    'membership.owner.bootstrapped', 'membership', v_owner_membership_id,
    'migration:20260817191000', 'database-migration',
    jsonb_build_object(
      'username', 'ethan', 'roleCode', 'platform_owner',
      'scopeKinds', jsonb_build_array('platform', 'tenant'),
      'previousTestOwnerRetained', true
    )
  );
end;
$$;
