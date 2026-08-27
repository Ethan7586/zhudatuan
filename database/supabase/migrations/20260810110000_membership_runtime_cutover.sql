-- Membership runtime cutover.
-- This migration is intentionally data-only for credentials: production
-- identity providers authenticate a subject, then map it through
-- member_login_aliases. No plaintext password is stored in PostgreSQL.

insert into public.permissions (id, code, name) values
  ('permission-finance-reconcile-v2', 'finance.reconcile', '查看财务对账')
on conflict (id) do update set code = excluded.code, name = excluded.name;

insert into public.roles (id, tenant_id, code, name) values
  ('role-platform-owner-v2', 'tenant-smart-wing', 'platform_owner', '平台业主'),
  ('role-enterprise-manager-v2', 'tenant-smart-wing', 'enterprise_manager', '企业运营经理')
on conflict (id) do update set code = excluded.code, name = excluded.name;

-- Membership roles are the only source of permissions at runtime.
insert into public.role_permissions (role_id, permission_id)
select grants.role_id, permissions.id
from (
  values
    ('role-employee', 'catalog.read'), ('role-employee', 'order.create'), ('role-employee', 'order.read'),
    ('role-mall-admin', 'catalog.read'), ('role-mall-admin', 'product.publish'), ('role-mall-admin', 'order.read'), ('role-mall-admin', 'order.ship'),
    ('role-enterprise-manager-v2', 'catalog.read'), ('role-enterprise-manager-v2', 'order.read'), ('role-enterprise-manager-v2', 'order.refund'), ('role-enterprise-manager-v2', 'finance.reconcile'), ('role-enterprise-manager-v2', 'audit.read'),
    ('role-platform-owner-v2', 'catalog.read'), ('role-platform-owner-v2', 'product.publish'), ('role-platform-owner-v2', 'order.create'), ('role-platform-owner-v2', 'order.read'), ('role-platform-owner-v2', 'order.ship'), ('role-platform-owner-v2', 'order.refund'),
    ('role-platform-owner-v2', 'finance.reconcile'), ('role-platform-owner-v2', 'member.read'), ('role-platform-owner-v2', 'member.invite'), ('role-platform-owner-v2', 'member.disable'), ('role-platform-owner-v2', 'role.read'), ('role-platform-owner-v2', 'role.grant'), ('role-platform-owner-v2', 'audit.read'), ('role-platform-owner-v2', 'tenant.manage')
) as grants(role_id, permission_code)
join public.permissions on permissions.code = grants.permission_code
on conflict do nothing;

-- Four test people, modelled exactly as production identities. Their test
-- password belongs only to the local development fixture, never this table.
insert into public.users (id, tenant_id, enterprise_id, department_id, employee_no, display_name, email, identity_subject, status) values
  ('user-test-storefront', 'tenant-smart-wing', 'enterprise-demo', 'department-digital', 'SW_TEST_STORE', '业主测试员', 'storefront.test@example.invalid', 'test:storefront', 'active'),
  ('user-test-fubao', 'tenant-smart-wing', 'enterprise-demo', 'department-digital', 'SW_TEST_FUBAO', '福宝', 'fubao.test@example.invalid', 'test:fubao', 'active'),
  ('user-test-manager', 'tenant-smart-wing', 'enterprise-demo', 'department-digital', 'SW_TEST_MANAGER', '经理1', 'manager.test@example.invalid', 'test:manager', 'active'),
  ('user-test-owner', 'tenant-smart-wing', 'enterprise-demo', 'department-digital', 'SW_TEST_OWNER', '李厚亿', 'owner.test@example.invalid', 'test:owner', 'active')
on conflict (id) do update set display_name = excluded.display_name, email = excluded.email, status = 'active', updated_at = now();

insert into public.members (id, user_id, primary_identifier, status) values
  ('member-test-storefront', 'user-test-storefront', 'test:storefront', 'active'),
  ('member-test-fubao', 'user-test-fubao', 'test:fubao', 'active'),
  ('member-test-manager', 'user-test-manager', 'test:manager', 'active'),
  ('member-test-owner', 'user-test-owner', 'test:owner', 'active')
on conflict (id) do update set user_id = excluded.user_id, primary_identifier = excluded.primary_identifier, status = 'active', updated_at = now();

insert into public.memberships (id, member_id, context_user_id, tenant_id, enterprise_id, mall_id, target, status) values
  ('membership-test-storefront', 'member-test-storefront', 'user-test-storefront', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'storefront', 'active'),
  ('membership-test-fubao-admin', 'member-test-fubao', 'user-test-fubao', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'admin', 'active'),
  ('membership-test-manager-admin', 'member-test-manager', 'user-test-manager', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'admin', 'active'),
  ('membership-test-owner-admin', 'member-test-owner', 'user-test-owner', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', 'admin', 'active')
on conflict (id) do update set status = 'active', updated_at = now();

insert into public.membership_roles (membership_id, role_id) values
  ('membership-test-storefront', 'role-employee'),
  ('membership-test-fubao-admin', 'role-mall-admin'),
  ('membership-test-manager-admin', 'role-enterprise-manager-v2'),
  ('membership-test-owner-admin', 'role-platform-owner-v2')
on conflict (membership_id, role_id) do update set revoked_at = null, expires_at = null;

insert into public.membership_scopes (membership_id, scope_kind, resource_id) values
  ('membership-test-storefront', 'self', 'user-test-storefront'),
  ('membership-test-fubao-admin', 'mall', 'mall-demo'),
  ('membership-test-manager-admin', 'enterprise', 'enterprise-demo'),
  ('membership-test-manager-admin', 'mall', 'mall-demo'),
  ('membership-test-owner-admin', 'tenant', 'tenant-smart-wing')
on conflict do nothing;

create table if not exists public.member_login_aliases (
  provider text not null,
  subject text not null,
  member_id text not null references public.members(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (provider, subject)
);

insert into public.member_login_aliases (provider, subject, member_id) values
  ('test', '业主测试员', 'member-test-storefront'),
  ('test', '福宝', 'member-test-fubao'),
  ('test', '经理1', 'member-test-manager'),
  ('test', 'onewr', 'member-test-owner'),
  ('test', '李厚亿', 'member-test-owner')
on conflict (provider, subject) do update set member_id = excluded.member_id;

revoke all on table public.member_login_aliases from public, anon, authenticated;
alter table public.member_login_aliases enable row level security;

-- The membership resolver is the sole runtime source for actor scope. It
-- derives the RPC fields from database joins and exposes no client-supplied
-- permissions or scope values.
create or replace function public.api_resolve_membership_context(p_member_id text, p_membership_id text, p_target text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with resolved as (
    select ms.*, u.employee_no, mall.code as mall_code
    from public.memberships ms
    join public.members member on member.id = ms.member_id
    join public.users u on u.id = ms.context_user_id
    join public.malls mall on mall.id = ms.mall_id
    where ms.id = p_membership_id
      and ms.member_id = p_member_id
      and ms.target = p_target
      and ms.status = 'active'
      and member.status = 'active'
      and u.status = 'active'
      and (ms.expires_at is null or ms.expires_at > now())
  )
  select jsonb_build_object(
    'id', r.id,
    'memberId', r.member_id,
    'target', r.target,
    'status', r.status,
    'roleIds', coalesce((
      select jsonb_agg(mr.role_id order by mr.role_id)
      from public.membership_roles mr
      where mr.membership_id = r.id and mr.revoked_at is null and (mr.expires_at is null or mr.expires_at > now())
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(distinct p.code order by p.code)
      from public.membership_roles mr
      join public.role_permissions rp on rp.role_id = mr.role_id
      join public.permissions p on p.id = rp.permission_id
      where mr.membership_id = r.id and mr.revoked_at is null and (mr.expires_at is null or mr.expires_at > now())
    ), '[]'::jsonb),
    'context', jsonb_strip_nulls(jsonb_build_object(
      'tenantId', r.tenant_id, 'enterpriseId', r.enterprise_id, 'mallId', r.mall_id,
      'supplierId', r.supplier_id, 'userId', r.context_user_id
    )),
    'scopeBindings', coalesce((
      select jsonb_agg(jsonb_build_object('kind', scope.scope_kind, 'resourceId', scope.resource_id) order by scope.scope_kind, scope.resource_id)
      from public.membership_scopes scope where scope.membership_id = r.id
    ), '[]'::jsonb),
    'expiresAt', r.expires_at,
    'authzVersion', r.authz_version,
    'actor', jsonb_build_object(
      'tenantId', r.tenant_id, 'enterpriseId', r.enterprise_id, 'mallId', r.mall_id,
      'mallCode', r.mall_code, 'userId', r.context_user_id, 'employeeNo', r.employee_no
    )
  )
  from resolved r;
$$;

revoke all on function public.api_resolve_membership_context(text, text, text) from public, anon, authenticated;
grant execute on function public.api_resolve_membership_context(text, text, text) to service_role;

-- Target scope lookups used before authorization for resource-addressed
-- mutations. They prevent a caller from inventing a mall or owner ID in a
-- request body and make decide() evaluate the resource's actual tenancy.
create or replace function public.api_order_authorization_scope(p_order_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'tenant_id', o.tenant_id,
    'enterprise_id', o.enterprise_id,
    'mall_id', o.mall_id,
    'user_id', o.user_id
  )
  from public.orders o
  where o.id = p_order_id;
$$;

create or replace function public.api_after_sale_authorization_scope(p_after_sale_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'tenant_id', o.tenant_id,
    'enterprise_id', o.enterprise_id,
    'mall_id', o.mall_id,
    'user_id', o.user_id
  )
  from public.after_sales a
  join public.orders o on o.id = a.order_id
  where a.id = p_after_sale_id;
$$;

revoke all on function public.api_order_authorization_scope(text) from public, anon, authenticated;
revoke all on function public.api_after_sale_authorization_scope(text) from public, anon, authenticated;
grant execute on function public.api_order_authorization_scope(text) to service_role;
grant execute on function public.api_after_sale_authorization_scope(text) to service_role;
