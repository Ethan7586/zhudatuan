-- First-party WeChat silent enrollment for the public storefront.
--
-- This deliberately narrows the earlier no-auto-bind invariant: a verified
-- AppID + OpenID may create one new basic storefront member in the
-- server-selected public mall. It never claims or merges an existing member,
-- never uses UnionID as an authorization key, and never accepts tenancy from
-- the mini-program.

create or replace function public.api_ensure_wechat_member(
  p_app_id text,
  p_open_id text,
  p_union_id text,
  p_mall_slug text,
  p_request_id text,
  p_user_agent text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_app_id text := trim(coalesce(p_app_id, ''));
  normalized_open_id text := trim(coalesce(p_open_id, ''));
  normalized_union_id text := nullif(trim(coalesce(p_union_id, '')), '');
  normalized_mall_slug text := trim(coalesce(p_mall_slug, ''));
  identity_hash text;
  identity_row public.member_wechat_identities%rowtype;
  mall_row record;
  public_role_id text;
  user_id text := gen_random_uuid()::text;
  created_member_id text := gen_random_uuid()::text;
  created_membership_id text := gen_random_uuid()::text;
  identity_subject text;
begin
  if length(normalized_app_id) not between 6 and 64
    or length(normalized_open_id) not between 6 and 128
    or (normalized_union_id is not null and length(normalized_union_id) not between 6 and 128)
    or length(normalized_mall_slug) not between 1 and 120
    or length(trim(coalesce(p_request_id, ''))) not between 1 and 160 then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- One AppID + OpenID can be enrolled exactly once even when two cold starts
  -- race before either receives its token.
  perform pg_advisory_xact_lock(
    hashtextextended('wechat-enroll:' || normalized_app_id || ':' || normalized_open_id, 0)
  );

  insert into public.member_wechat_identities (app_id, open_id, union_id)
  values (normalized_app_id, normalized_open_id, normalized_union_id)
  on conflict (app_id, open_id) do nothing;

  select * into identity_row
  from public.member_wechat_identities
  where app_id = normalized_app_id and open_id = normalized_open_id
  for update;

  if not found or identity_row.revoked_at is not null then
    return jsonb_build_object('status', 'identity_conflict');
  end if;
  if identity_row.union_id is not null
    and normalized_union_id is not null
    and identity_row.union_id <> normalized_union_id then
    return jsonb_build_object('status', 'identity_conflict');
  end if;

  if identity_row.member_id is not null or identity_row.membership_id is not null then
    if exists (
      select 1
      from public.members member
      join public.memberships membership
        on membership.id = identity_row.membership_id
       and membership.member_id = member.id
      join public.users user_row on user_row.id = membership.context_user_id
      where member.id = identity_row.member_id
        and member.status = 'active'
        and membership.target = 'storefront'
        and membership.status = 'active'
        and (membership.expires_at is null or membership.expires_at > now())
        and user_row.status = 'active'
    ) then
      return jsonb_build_object(
        'status', 'active',
        'created', false,
        'memberId', identity_row.member_id,
        'membershipId', identity_row.membership_id
      );
    end if;
    return jsonb_build_object('status', 'identity_inactive');
  end if;

  select
    mall.id,
    mall.tenant_id,
    mall.enterprise_id,
    mall.code
  into mall_row
  from public.malls mall
  join public.tenants tenant
    on tenant.id = mall.tenant_id and tenant.status = 'active'
  join public.enterprises enterprise
    on enterprise.id = mall.enterprise_id
   and enterprise.tenant_id = mall.tenant_id
   and enterprise.status = 'active'
  where mall.public_slug = normalized_mall_slug
    and mall.status = 'active'
  limit 1;

  if not found then
    return jsonb_build_object('status', 'mall_unavailable');
  end if;

  identity_hash := encode(digest(normalized_app_id || ':' || normalized_open_id, 'sha256'), 'hex');
  identity_subject := 'wechat:' || identity_hash;

  insert into public.roles (
    id, tenant_id, code, name, description, is_system, is_owner,
    is_editable, sort_order, status, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    mall_row.tenant_id,
    'public_member',
    '公开商城会员',
    '微信首次进入时创建的基础商城会员；企业资格与手机认证后置。',
    true,
    false,
    false,
    900,
    'active',
    now(),
    now()
  )
  on conflict (tenant_id, code) do update set
    status = 'active',
    updated_at = now()
  returning id into public_role_id;

  insert into public.role_permissions (role_id, permission_id)
  select public_role_id, permission.id
  from public.permissions permission
  where permission.code in ('catalog.read', 'order.create', 'order.read')
  on conflict do nothing;

  insert into public.users (
    id, tenant_id, enterprise_id, employee_no, display_name,
    identity_subject, status
  ) values (
    user_id,
    mall_row.tenant_id,
    mall_row.enterprise_id,
    'WX-' || left(identity_hash, 24),
    '微信会员',
    identity_subject,
    'active'
  );

  insert into public.members (id, user_id, primary_identifier, status)
  values (created_member_id, user_id, identity_subject, 'active');

  insert into public.memberships (
    id, member_id, context_user_id, tenant_id, enterprise_id, mall_id,
    target, status, authz_version
  ) values (
    created_membership_id,
    created_member_id,
    user_id,
    mall_row.tenant_id,
    mall_row.enterprise_id,
    mall_row.id,
    'storefront',
    'active',
    1
  );

  insert into public.membership_scopes (membership_id, scope_kind, resource_id)
  values (created_membership_id, 'self', user_id);

  insert into public.membership_roles (membership_id, role_id)
  values (created_membership_id, public_role_id);

  insert into public.welfare_accounts (
    id, tenant_id, enterprise_id, mall_id, user_id, account_type,
    balance_cents, version, status
  ) values
    (gen_random_uuid()::text, mall_row.tenant_id, mall_row.enterprise_id, mall_row.id, user_id, 'welfare', 0, 0, 'active'),
    (gen_random_uuid()::text, mall_row.tenant_id, mall_row.enterprise_id, mall_row.id, user_id, 'meal', 0, 0, 'active');

  update public.member_wechat_identities
  set union_id = coalesce(union_id, normalized_union_id),
      member_id = created_member_id,
      membership_id = created_membership_id,
      bound_at = now(),
      updated_at = now()
  where id = identity_row.id;

  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type,
    action, resource_type, resource_id, request_id, user_agent,
    after_json, membership_id, granted_via
  ) values (
    gen_random_uuid()::text,
    mall_row.tenant_id,
    mall_row.enterprise_id,
    mall_row.id,
    user_id,
    'system',
    'wechat_member.silent_enrolled',
    'member_wechat_identity',
    identity_row.id::text,
    trim(p_request_id),
    left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('created', true, 'profileState', 'basic'),
    created_membership_id,
    jsonb_build_object('channel', 'wechat_miniapp', 'mode', 'silent_enrollment')
  );

  return jsonb_build_object(
    'status', 'active',
    'created', true,
    'memberId', created_member_id,
    'membershipId', created_membership_id
  );
exception
  when unique_violation then
    -- A legacy write path may have raced this function. Never guess which
    -- existing account owns that identity; the next request resolves it.
    return jsonb_build_object('status', 'identity_conflict');
end;
$$;

revoke all on function public.api_ensure_wechat_member(text,text,text,text,text,text)
from public, anon, authenticated;
grant execute on function public.api_ensure_wechat_member(text,text,text,text,text,text)
to service_role;

notify pgrst, 'reload schema';
