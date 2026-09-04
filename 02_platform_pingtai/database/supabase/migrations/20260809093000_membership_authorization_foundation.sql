-- Membership-bound authorization foundation.
-- Do not enable AUTH_MODE=membership until commerce-api routes use this model
-- and the cross-tenant RPC contract suite has passed.

create table if not exists public.members (
  id text primary key,
  user_id text unique references public.users(id) on delete restrict,
  primary_identifier text unique,
  status text not null check (status in ('active', 'suspended')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id text primary key,
  member_id text not null references public.members(id) on delete restrict,
  context_user_id text references public.users(id) on delete restrict,
  tenant_id text not null references public.tenants(id) on delete restrict,
  enterprise_id text references public.enterprises(id) on delete restrict,
  mall_id text references public.malls(id) on delete restrict,
  supplier_id text references public.suppliers(id) on delete restrict,
  target text not null check (target in ('storefront', 'admin')),
  status text not null check (status in ('invited', 'active', 'suspended', 'offboarded', 'expired')) default 'invited',
  authz_version integer not null default 1 check (authz_version > 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_scopes (
  membership_id text not null references public.memberships(id) on delete restrict,
  scope_kind text not null check (scope_kind in ('tenant', 'enterprise', 'mall', 'supplier', 'self')),
  resource_id text not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, scope_kind, resource_id)
);

create table if not exists public.membership_roles (
  membership_id text not null references public.memberships(id) on delete restrict,
  role_id text not null references public.roles(id) on delete restrict,
  granted_by_membership_id text references public.memberships(id) on delete restrict,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  primary key (membership_id, role_id)
);

create index if not exists idx_memberships_lookup on public.memberships (member_id, target, status, expires_at);
create index if not exists idx_memberships_context on public.memberships (tenant_id, enterprise_id, mall_id, supplier_id);
create index if not exists idx_membership_scopes_lookup on public.membership_scopes (scope_kind, resource_id);

create or replace function public.validate_membership_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  membership_row public.memberships%rowtype;
  is_valid boolean := false;
begin
  select * into membership_row from public.memberships where id = new.membership_id;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;

  if new.scope_kind = 'tenant' then
    is_valid := new.resource_id = membership_row.tenant_id;
  elsif new.scope_kind = 'enterprise' then
    select exists(select 1 from public.enterprises e where e.id = new.resource_id and e.tenant_id = membership_row.tenant_id) into is_valid;
  elsif new.scope_kind = 'mall' then
    select exists(select 1 from public.malls m where m.id = new.resource_id and m.tenant_id = membership_row.tenant_id) into is_valid;
  elsif new.scope_kind = 'supplier' then
    select exists(select 1 from public.suppliers s where s.id = new.resource_id and s.tenant_id = membership_row.tenant_id) into is_valid;
  elsif new.scope_kind = 'self' then
    is_valid := new.resource_id = membership_row.context_user_id;
  end if;

  if not coalesce(is_valid, false) then raise exception 'MEMBERSHIP_SCOPE_OUTSIDE_TENANT'; end if;
  return new;
end;
$$;

drop trigger if exists membership_scopes_validate on public.membership_scopes;
create trigger membership_scopes_validate before insert or update on public.membership_scopes
for each row execute function public.validate_membership_scope();

create or replace function public.bump_membership_authz_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  affected_membership_id text;
begin
  affected_membership_id := coalesce(new.membership_id, old.membership_id);
  update public.memberships set authz_version = authz_version + 1, updated_at = now() where id = affected_membership_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists membership_scopes_bump_version on public.membership_scopes;
create trigger membership_scopes_bump_version after insert or update or delete on public.membership_scopes
for each row execute function public.bump_membership_authz_version();

drop trigger if exists membership_roles_bump_version on public.membership_roles;
create trigger membership_roles_bump_version after insert or update or delete on public.membership_roles
for each row execute function public.bump_membership_authz_version();

create or replace function public.bump_membership_version_on_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status or new.expires_at is distinct from old.expires_at then
    new.authz_version := old.authz_version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists memberships_status_bump_version on public.memberships;
create trigger memberships_status_bump_version before update on public.memberships
for each row execute function public.bump_membership_version_on_status_change();

insert into public.permissions (id, code, name) values
  ('permission-catalog-read-v2', 'catalog.read', '查看商品'),
  ('permission-order-create-v2', 'order.create', '创建订单'),
  ('permission-order-read-v2', 'order.read', '查看订单'),
  ('permission-product-publish-v2', 'product.publish', '发布商品'),
  ('permission-order-ship-v2', 'order.ship', '订单发货'),
  ('permission-order-refund-v2', 'order.refund', '执行退款'),
  ('permission-member-read-v2', 'member.read', '查看成员'),
  ('permission-member-invite-v2', 'member.invite', '邀请成员'),
  ('permission-member-disable-v2', 'member.disable', '停用成员'),
  ('permission-role-read-v2', 'role.read', '查看角色'),
  ('permission-role-grant-v2', 'role.grant', '授予角色'),
  ('permission-audit-read-v2', 'audit.read', '查看审计'),
  ('permission-tenant-manage-v2', 'tenant.manage', '管理租户')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on (
  (r.code = 'employee' and p.code in ('catalog.read', 'order.create', 'order.read')) or
  (r.code = 'mall_admin' and p.code in ('catalog.read', 'product.publish', 'order.read', 'order.ship'))
)
on conflict do nothing;

-- Backfill the existing roles into distinct memberships.
insert into public.members (id, user_id, primary_identifier, status)
select 'member-' || u.id, u.id, u.employee_no, case when u.status = 'active' then 'active' else 'suspended' end
from public.users u
on conflict (id) do nothing;

insert into public.memberships (id, member_id, context_user_id, tenant_id, enterprise_id, mall_id, target, status)
select 'membership-storefront-' || u.id, 'member-' || u.id, u.id, u.tenant_id, u.enterprise_id, mall.id, 'storefront',
  case when u.status = 'active' then 'active' else 'suspended' end
from public.users u
join public.user_roles ur on ur.user_id = u.id and ur.tenant_id = u.tenant_id
join public.roles r on r.id = ur.role_id and r.code = 'employee'
join lateral (
  select m.id from public.malls m
  where m.tenant_id = u.tenant_id and m.enterprise_id = u.enterprise_id and m.status = 'active'
  order by m.id limit 1
) mall on true
on conflict (id) do nothing;

insert into public.memberships (id, member_id, context_user_id, tenant_id, enterprise_id, mall_id, target, status)
select 'membership-admin-' || u.id, 'member-' || u.id, u.id, u.tenant_id, u.enterprise_id, mall.id, 'admin',
  case when u.status = 'active' then 'active' else 'suspended' end
from public.users u
join public.user_roles ur on ur.user_id = u.id and ur.tenant_id = u.tenant_id
join public.roles r on r.id = ur.role_id and r.code = 'mall_admin'
join lateral (
  select m.id from public.malls m
  where m.tenant_id = u.tenant_id and m.enterprise_id = u.enterprise_id and m.status = 'active'
  order by m.id limit 1
) mall on true
on conflict (id) do nothing;

insert into public.membership_roles (membership_id, role_id)
select ms.id, ur.role_id
from public.memberships ms
join public.members member on member.id = ms.member_id
join public.user_roles ur on ur.user_id = member.user_id and ur.tenant_id = ms.tenant_id
join public.roles r on r.id = ur.role_id
where (ms.target = 'storefront' and r.code = 'employee')
   or (ms.target = 'admin' and r.code = 'mall_admin')
on conflict do nothing;

insert into public.membership_scopes (membership_id, scope_kind, resource_id)
select id, 'self', context_user_id from public.memberships
where target = 'storefront' and context_user_id is not null
on conflict do nothing;

insert into public.membership_scopes (membership_id, scope_kind, resource_id)
select id, 'mall', mall_id from public.memberships
where target = 'admin' and mall_id is not null
on conflict do nothing;

alter table public.audit_logs add column if not exists membership_id text references public.memberships(id) on delete restrict;
alter table public.audit_logs add column if not exists granted_via jsonb;
create index if not exists idx_audit_membership on public.audit_logs (membership_id, created_at desc);

create or replace function public.api_resolve_membership_context(p_member_id text, p_membership_id text, p_target text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with resolved as (
    select ms.*
    from public.memberships ms
    join public.members member on member.id = ms.member_id
    where ms.id = p_membership_id
      and ms.member_id = p_member_id
      and ms.target = p_target
      and ms.status = 'active'
      and member.status = 'active'
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
      select jsonb_agg(jsonb_build_object('kind', ms.scope_kind, 'resourceId', ms.resource_id) order by ms.scope_kind, ms.resource_id)
      from public.membership_scopes ms where ms.membership_id = r.id
    ), '[]'::jsonb),
    'expiresAt', r.expires_at,
    'authzVersion', r.authz_version
  )
  from resolved r;
$$;

revoke all on table public.members, public.memberships, public.membership_scopes, public.membership_roles from anon, authenticated;
alter table public.members enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_scopes enable row level security;
alter table public.membership_roles enable row level security;
revoke all on function public.api_resolve_membership_context(text, text, text) from public, anon, authenticated;
grant execute on function public.api_resolve_membership_context(text, text, text) to service_role;

