-- Public test roster requested for buyer, seller, operations, customer-service
-- and administrator acceptance testing. Password verification remains in the
-- test-only application fixture; PostgreSQL stores no plaintext password.

insert into public.roles (id, tenant_id, code, name) values
  ('role-test-buyer', 'tenant-smart-wing', 'test_buyer', '测试买家'),
  ('role-test-seller', 'tenant-smart-wing', 'test_seller', '测试商家'),
  ('role-test-operations', 'tenant-smart-wing', 'test_operations', '测试运营'),
  ('role-test-customer-service', 'tenant-smart-wing', 'test_customer_service', '测试客服'),
  ('role-test-admin', 'tenant-smart-wing', 'test_admin', '测试企业管理员')
on conflict (tenant_id, code) do update set name = excluded.name;

insert into public.role_permissions (role_id, permission_id)
select grants.role_id, permissions.id
from (
  values
    ('role-test-buyer', 'catalog.read'),
    ('role-test-buyer', 'order.create'),
    ('role-test-buyer', 'order.read'),

    ('role-test-seller', 'catalog.read'),
    ('role-test-seller', 'product.publish'),
    ('role-test-seller', 'order.read'),
    ('role-test-seller', 'order.ship'),

    ('role-test-operations', 'catalog.read'),
    ('role-test-operations', 'product.publish'),
    ('role-test-operations', 'order.read'),
    ('role-test-operations', 'order.ship'),
    ('role-test-operations', 'audit.read'),

    ('role-test-customer-service', 'catalog.read'),
    ('role-test-customer-service', 'order.read'),
    ('role-test-customer-service', 'member.read'),

    ('role-test-admin', 'catalog.read'),
    ('role-test-admin', 'product.publish'),
    ('role-test-admin', 'order.read'),
    ('role-test-admin', 'order.ship'),
    ('role-test-admin', 'order.refund'),
    ('role-test-admin', 'finance.reconcile'),
    ('role-test-admin', 'member.read'),
    ('role-test-admin', 'member.invite'),
    ('role-test-admin', 'member.disable'),
    ('role-test-admin', 'role.read'),
    ('role-test-admin', 'audit.read')
) as grants(role_id, permission_code)
join public.permissions on permissions.code = grants.permission_code
on conflict do nothing;

with roster as (
  select role_prefix, account_index, role_prefix || lpad(account_index::text, 3, '0') as username
  from (values ('buyer'), ('seller'), ('ops'), ('cs'), ('admin')) roles(role_prefix)
  cross join generate_series(1, 5) as indices(account_index)
)
insert into public.users (
  id, tenant_id, enterprise_id, department_id, employee_no, display_name, email, identity_subject, status
)
select
  'user-test-' || role_prefix || '-' || lpad(account_index::text, 3, '0'),
  'tenant-smart-wing',
  'enterprise-demo',
  'department-digital',
  username,
  case role_prefix
    when 'buyer' then '测试买家'
    when 'seller' then '测试商家'
    when 'ops' then '测试运营'
    when 'cs' then '测试客服'
    else '测试企业管理员'
  end || lpad(account_index::text, 3, '0'),
  username || '@test.smart-wing.invalid',
  'test:' || username,
  'active'
from roster
on conflict (id) do update set
  employee_no = excluded.employee_no,
  display_name = excluded.display_name,
  email = excluded.email,
  identity_subject = excluded.identity_subject,
  status = 'active',
  updated_at = now();

with roster as (
  select role_prefix, account_index, role_prefix || lpad(account_index::text, 3, '0') as username
  from (values ('buyer'), ('seller'), ('ops'), ('cs'), ('admin')) roles(role_prefix)
  cross join generate_series(1, 5) as indices(account_index)
)
insert into public.members (id, user_id, primary_identifier, status)
select
  'member-test-' || role_prefix || '-' || lpad(account_index::text, 3, '0'),
  'user-test-' || role_prefix || '-' || lpad(account_index::text, 3, '0'),
  'test:' || username,
  'active'
from roster
on conflict (id) do update set
  user_id = excluded.user_id,
  primary_identifier = excluded.primary_identifier,
  status = 'active',
  updated_at = now();

with roster as (
  select role_prefix, account_index
  from (values ('buyer'), ('seller'), ('ops'), ('cs'), ('admin')) roles(role_prefix)
  cross join generate_series(1, 5) as indices(account_index)
)
insert into public.memberships (
  id, member_id, context_user_id, tenant_id, enterprise_id, mall_id, target, status
)
select
  'membership-test-' || role_prefix || '-' || lpad(account_index::text, 3, '0'),
  'member-test-' || role_prefix || '-' || lpad(account_index::text, 3, '0'),
  'user-test-' || role_prefix || '-' || lpad(account_index::text, 3, '0'),
  'tenant-smart-wing',
  'enterprise-demo',
  'mall-demo',
  case when role_prefix = 'buyer' then 'storefront' else 'admin' end,
  'active'
from roster
on conflict (id) do update set
  target = excluded.target,
  status = 'active',
  updated_at = now();

with roster as (
  select role_prefix, account_index
  from (values ('buyer'), ('seller'), ('ops'), ('cs'), ('admin')) roles(role_prefix)
  cross join generate_series(1, 5) as indices(account_index)
)
insert into public.membership_roles (membership_id, role_id)
select
  'membership-test-' || role_prefix || '-' || lpad(account_index::text, 3, '0'),
  case role_prefix
    when 'buyer' then 'role-test-buyer'
    when 'seller' then 'role-test-seller'
    when 'ops' then 'role-test-operations'
    when 'cs' then 'role-test-customer-service'
    else 'role-test-admin'
  end
from roster
on conflict (membership_id, role_id) do update set revoked_at = null, expires_at = null;

with roster as (
  select role_prefix, account_index
  from (values ('buyer'), ('seller'), ('ops'), ('cs'), ('admin')) roles(role_prefix)
  cross join generate_series(1, 5) as indices(account_index)
)
insert into public.membership_scopes (membership_id, scope_kind, resource_id)
select
  'membership-test-' || role_prefix || '-' || lpad(account_index::text, 3, '0'),
  case when role_prefix = 'buyer' then 'self' when role_prefix = 'admin' then 'enterprise' else 'mall' end,
  case
    when role_prefix = 'buyer' then 'user-test-buyer-' || lpad(account_index::text, 3, '0')
    when role_prefix = 'admin' then 'enterprise-demo'
    else 'mall-demo'
  end
from roster
on conflict do nothing;

insert into public.membership_scopes (membership_id, scope_kind, resource_id)
select
  'membership-test-admin-' || lpad(account_index::text, 3, '0'),
  'mall',
  'mall-demo'
from generate_series(1, 5) as indices(account_index)
on conflict do nothing;

with roster as (
  select role_prefix, account_index, role_prefix || lpad(account_index::text, 3, '0') as username
  from (values ('buyer'), ('seller'), ('ops'), ('cs'), ('admin')) roles(role_prefix)
  cross join generate_series(1, 5) as indices(account_index)
)
insert into public.member_login_aliases (provider, subject, member_id)
select
  'test',
  username,
  'member-test-' || role_prefix || '-' || lpad(account_index::text, 3, '0')
from roster
on conflict (provider, subject) do update set member_id = excluded.member_id;

-- Preserve the old user_roles projection for legacy readers while membership_roles
-- remains the sole runtime authorization source.
with roster as (
  select role_prefix, account_index
  from (values ('buyer'), ('seller'), ('ops'), ('cs'), ('admin')) roles(role_prefix)
  cross join generate_series(1, 5) as indices(account_index)
)
insert into public.user_roles (tenant_id, user_id, role_id)
select
  'tenant-smart-wing',
  'user-test-' || role_prefix || '-' || lpad(account_index::text, 3, '0'),
  case role_prefix
    when 'buyer' then 'role-test-buyer'
    when 'seller' then 'role-test-seller'
    when 'ops' then 'role-test-operations'
    when 'cs' then 'role-test-customer-service'
    else 'role-test-admin'
  end
from roster
on conflict (user_id, role_id) do nothing;

-- Buyer accounts receive empty, isolated test wallets so checkout simulations
-- cannot touch any existing member's balance.
with buyers as (
  select account_index from generate_series(1, 5) as indices(account_index)
)
insert into public.welfare_accounts (
  id, tenant_id, enterprise_id, mall_id, user_id, account_type, balance_cents, status
)
select
  'acct-user-test-buyer-' || lpad(account_index::text, 3, '0') || '-' || account_type,
  'tenant-smart-wing',
  'enterprise-demo',
  'mall-demo',
  'user-test-buyer-' || lpad(account_index::text, 3, '0'),
  account_type,
  0,
  'active'
from buyers
cross join (values ('welfare'::text), ('meal'::text)) account_types(account_type)
on conflict (mall_id, user_id, account_type) do update set status = 'active';

insert into public.test_points_wallets (id, tenant_id, enterprise_id, mall_id, user_id)
select
  'points-user-test-buyer-' || lpad(account_index::text, 3, '0'),
  'tenant-smart-wing',
  'enterprise-demo',
  'mall-demo',
  'user-test-buyer-' || lpad(account_index::text, 3, '0')
from generate_series(1, 5) as indices(account_index)
on conflict (mall_id, user_id) do nothing;
