-- Smart Wing membership + permission command center MVP.
-- Role grants are additive; explicit membership denies win at runtime.
-- Owner is unique, protected and can only be transferred through a separate ceremony.

alter table public.permissions add column if not exists category text not null default '其他';
alter table public.permissions add column if not exists risk_level text not null default 'low'
  check (risk_level in ('low', 'elevated', 'high', 'critical'));
alter table public.permissions add column if not exists is_mvp boolean not null default true;

alter table public.roles add column if not exists description text not null default '';
alter table public.roles add column if not exists is_system boolean not null default false;
alter table public.roles add column if not exists is_owner boolean not null default false;
alter table public.roles add column if not exists is_editable boolean not null default true;
alter table public.roles add column if not exists sort_order integer not null default 100;

create unique index if not exists roles_one_owner_per_tenant
on public.roles (tenant_id) where is_owner;

update public.roles set is_system = true, is_owner = true, is_editable = false, sort_order = 1
where code = 'platform_owner';

alter table public.membership_scopes drop constraint if exists membership_scopes_scope_kind_check;
alter table public.membership_scopes add constraint membership_scopes_scope_kind_check
check (scope_kind in ('tenant','distributor','enterprise','mall','supplier','brand','store','department','self'));

create or replace function public.validate_membership_scope()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare membership_row public.memberships%rowtype; is_valid boolean:=false;
begin
  select * into membership_row from public.memberships where id=new.membership_id;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  if new.scope_kind='tenant' then is_valid:=new.resource_id=membership_row.tenant_id;
  elsif new.scope_kind='enterprise' then select exists(select 1 from public.enterprises e where e.id=new.resource_id and e.tenant_id=membership_row.tenant_id) into is_valid;
  elsif new.scope_kind='mall' then select exists(select 1 from public.malls m where m.id=new.resource_id and m.tenant_id=membership_row.tenant_id) into is_valid;
  elsif new.scope_kind='supplier' then select exists(select 1 from public.suppliers s where s.id=new.resource_id and s.tenant_id=membership_row.tenant_id) into is_valid;
  elsif new.scope_kind='department' then select exists(select 1 from public.departments d where d.id=new.resource_id and d.tenant_id=membership_row.tenant_id and d.enterprise_id=membership_row.enterprise_id) into is_valid;
  elsif new.scope_kind='self' then is_valid:=new.resource_id=membership_row.context_user_id;
  elsif new.scope_kind in ('distributor','brand','store') then raise exception 'MEMBERSHIP_SCOPE_KIND_RESERVED';
  end if;
  if not coalesce(is_valid,false) then raise exception 'MEMBERSHIP_SCOPE_OUTSIDE_TENANT'; end if;
  return new;
end;
$$;

insert into public.permissions(id,code,name,category,risk_level,is_mvp) values
  ('permission-profile-read-self-mvp','profile.read.self','查看本人资料','账号安全','low',true),
  ('permission-profile-update-self-mvp','profile.update.self','修改本人资料','账号安全','low',true),
  ('permission-credential-password-change-self-mvp','credential.password.change.self','修改本人密码','账号安全','elevated',true),
  ('permission-credential-phone-change-self-mvp','credential.phone.change.self','修改本人手机','账号安全','high',true),
  ('permission-credential-password-reset-other-mvp','credential.password.reset.other','重置他人密码','账号安全','critical',true),
  ('permission-credential-phone-reset-other-mvp','credential.phone.reset.other','重置他人手机','账号安全','critical',true),
  ('permission-session-read-self-mvp','session.read.self','查看本人会话','账号安全','low',true),
  ('permission-session-revoke-self-mvp','session.revoke.self','退出本人其他会话','账号安全','elevated',true),
  ('permission-session-revoke-other-mvp','session.revoke.other','强制退出他人会话','账号安全','critical',true),
  ('permission-product-create-mvp','product.create','新增商品','商品','low',true),
  ('permission-product-update-mvp','product.update','编辑商品','商品','elevated',true),
  ('permission-product-delete-mvp','product.delete','删除未交易商品','商品','critical',true),
  ('permission-price-read-cost-mvp','price.read.cost','查看成本价','商品','high',true),
  ('permission-price-update-mvp','price.update','修改价格','商品','critical',true),
  ('permission-inventory-read-mvp','inventory.read','查看库存','商品','low',true),
  ('permission-inventory-update-mvp','inventory.update','调整库存','商品','high',true),
  ('permission-order-cancel-mvp','order.cancel','取消订单','订单','high',true),
  ('permission-order-export-mvp','order.export','导出订单','订单','high',true),
  ('permission-aftersale-read-mvp','aftersale.read','查看售后','售后','low',true),
  ('permission-aftersale-handle-mvp','aftersale.handle','处理售后','售后','high',true),
  ('permission-voucher-read-mvp','voucher.read','查看卡券','卡券','low',true),
  ('permission-voucher-create-mvp','voucher.create','创建卡券','卡券','high',true),
  ('permission-voucher-issue-mvp','voucher.issue','发放卡券','卡券','critical',true),
  ('permission-voucher-activate-mvp','voucher.activate','激活卡券','卡券','high',true),
  ('permission-voucher-disable-mvp','voucher.disable','禁用卡券','卡券','high',true),
  ('permission-voucher-extend-mvp','voucher.extend','延期卡券','卡券','high',true),
  ('permission-voucher-void-mvp','voucher.void','作废卡券','卡券','critical',true),
  ('permission-voucher-export-mvp','voucher.export','导出卡券','卡券','critical',true),
  ('permission-finance-read-mvp','finance.read','查看财务','财务','elevated',true),
  ('permission-finance-payment-configure-mvp','finance.payment.configure','配置支付渠道','财务','critical',true),
  ('permission-finance-withdraw-mvp','finance.withdraw','申请或执行提现','财务','critical',true),
  ('permission-finance-settlement-approve-mvp','finance.settlement.approve','审批结算','财务','critical',true),
  ('permission-finance-invoice-manage-mvp','finance.invoice.manage','管理发票','财务','high',true),
  ('permission-finance-export-mvp','finance.export','导出财务数据','财务','critical',true),
  ('permission-analytics-read-mvp','analytics.read','查看数据统计','数据','low',true),
  ('permission-analytics-export-mvp','analytics.export','导出统计数据','数据','high',true),
  ('permission-member-pii-read-mvp','member.pii.read','查看会员敏感信息','会员','high',true),
  ('permission-member-update-mvp','member.update','编辑会员','会员','high',true),
  ('permission-member-offboard-mvp','member.offboard','移除会员','会员','critical',true),
  ('permission-member-import-mvp','member.import','批量导入会员','会员','high',true),
  ('permission-member-export-mvp','member.export','导出会员','会员','critical',true),
  ('permission-role-create-mvp','role.create','创建角色','权限','high',true),
  ('permission-role-update-mvp','role.update','编辑角色','权限','critical',true),
  ('permission-role-delete-mvp','role.delete','删除角色','权限','critical',true),
  ('permission-scope-grant-mvp','scope.grant','授予数据范围','权限','critical',true),
  ('permission-organization-read-mvp','organization.read','查看组织','组织','low',true),
  ('permission-organization-manage-mvp','organization.manage','管理组织部门','组织','high',true),
  ('permission-mall-read-mvp','mall.read','查看商城','商城','low',true),
  ('permission-mall-manage-mvp','mall.manage','管理商城','商城','high',true),
  ('permission-mall-decorate-mvp','mall.decorate','装修商城','商城','elevated',true),
  ('permission-mall-publish-mvp','mall.publish','发布商城版本','商城','high',true),
  ('permission-supplier-read-mvp','supplier.read','查看供应商','供应商','low',true),
  ('permission-supplier-manage-mvp','supplier.manage','管理供应商','供应商','high',true),
  ('permission-store-read-mvp','store.read','查看门店','门店','low',true),
  ('permission-store-manage-mvp','store.manage','管理门店','门店','high',true),
  ('permission-customer-service-read-mvp','customer_service.read','查看客服记录','客服','low',true),
  ('permission-customer-service-handle-mvp','customer_service.handle','处理客服会话','客服','elevated',true),
  ('permission-customer-service-manage-mvp','customer_service.manage','配置客服规则','客服','high',true),
  ('permission-audit-export-mvp','audit.export','导出审计','安全','critical',true),
  ('permission-security-policy-manage-mvp','security.policy.manage','管理安全策略','安全','critical',true),
  ('permission-integration-read-mvp','integration.read','查看接口配置','接口','high',true),
  ('permission-integration-secrets-manage-mvp','integration.secrets.manage','管理接口密钥','接口','critical',true)
on conflict(code) do update set name=excluded.name,category=excluded.category,risk_level=excluded.risk_level,is_mvp=excluded.is_mvp;

update public.permissions set category=case
  when code like 'catalog.%' or code like 'product.%' or code like 'price.%' or code like 'inventory.%' then '商品'
  when code like 'order.%' and code<>'order.refund' then '订单'
  when code='order.refund' then '售后' when code like 'finance.%' then '财务'
  when code like 'member.%' then '会员' when code like 'role.%' then '权限'
  when code like 'audit.%' then '安全' when code like 'tenant.%' then '平台' else category end,
  risk_level=case when code in ('product.publish','order.ship','finance.reconcile','member.invite') then 'high'
    when code in ('order.refund','member.disable','role.grant','tenant.manage') then 'critical' else risk_level end;

update public.roles set is_system=true,sort_order=case code
  when 'employee' then 10 when 'mall_admin' then 50 when 'enterprise_manager' then 60
  when 'test_buyer' then 110 when 'test_seller' then 120 when 'test_operations' then 130
  when 'test_customer_service' then 140 when 'test_admin' then 150 else sort_order end
where code in ('employee','mall_admin','enterprise_manager','platform_owner','test_buyer','test_seller','test_operations','test_customer_service','test_admin');

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on (
  (r.code='employee' and p.code in ('profile.read.self','profile.update.self','credential.password.change.self','credential.phone.change.self','session.read.self','session.revoke.self')) or
  (r.code='platform_owner') or
  (r.code in ('mall_admin','enterprise_manager','test_admin') and p.code in ('member.read','member.invite','member.update','member.disable','role.read','organization.read','mall.read')) or
  (r.code in ('mall_admin','enterprise_manager','test_admin','test_operations') and p.code in ('analytics.read','aftersale.read','aftersale.handle')) or
  (r.code in ('test_seller','test_operations') and p.code in ('product.create','product.update','inventory.read','inventory.update')) or
  (r.code='test_customer_service' and p.code in ('aftersale.read','aftersale.handle','customer_service.read','customer_service.handle'))
) on conflict do nothing;

create table if not exists public.membership_permission_overrides (
  membership_id text not null references public.memberships(id) on delete restrict,
  permission_id text not null references public.permissions(id) on delete restrict,
  effect text not null check (effect in ('allow', 'deny')),
  granted_by_membership_id text not null references public.memberships(id) on delete restrict,
  reason text not null check (length(trim(reason)) >= 4),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (membership_id, permission_id)
);

create index if not exists membership_permission_overrides_active
on public.membership_permission_overrides (membership_id, effect, expires_at)
where revoked_at is null;

drop trigger if exists membership_permission_overrides_bump_version on public.membership_permission_overrides;
create trigger membership_permission_overrides_bump_version
after insert or update or delete on public.membership_permission_overrides
for each row execute function public.bump_membership_authz_version();

revoke all on table public.membership_permission_overrides from public, anon, authenticated;
alter table public.membership_permission_overrides enable row level security;

create or replace function public.api_resolve_membership_context(p_member_id text, p_membership_id text, p_target text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with resolved as (
    select ms.*, u.employee_no, mall.code as mall_code
    from public.memberships ms join public.members member on member.id=ms.member_id
    join public.users u on u.id=ms.context_user_id join public.malls mall on mall.id=ms.mall_id
    where ms.id=p_membership_id and ms.member_id=p_member_id and ms.target=p_target
      and ms.status='active' and member.status='active' and u.status='active'
      and (ms.expires_at is null or ms.expires_at>now())
  ), granted as (
    select distinct p.code from resolved r join public.membership_roles mr on mr.membership_id=r.id
    join public.role_permissions rp on rp.role_id=mr.role_id join public.permissions p on p.id=rp.permission_id
    where mr.revoked_at is null and (mr.expires_at is null or mr.expires_at>now())
    union
    select p.code from resolved r join public.membership_permission_overrides mpo on mpo.membership_id=r.id
    join public.permissions p on p.id=mpo.permission_id
    where mpo.effect='allow' and mpo.revoked_at is null and (mpo.expires_at is null or mpo.expires_at>now())
  ), denied as (
    select p.code from resolved r join public.membership_permission_overrides mpo on mpo.membership_id=r.id
    join public.permissions p on p.id=mpo.permission_id
    where mpo.effect='deny' and mpo.revoked_at is null and (mpo.expires_at is null or mpo.expires_at>now())
  )
  select jsonb_build_object(
    'id',r.id,'memberId',r.member_id,'target',r.target,'status',r.status,
    'roleIds',coalesce((select jsonb_agg(mr.role_id order by mr.role_id) from public.membership_roles mr where mr.membership_id=r.id and mr.revoked_at is null and (mr.expires_at is null or mr.expires_at>now())),'[]'::jsonb),
    'permissions',coalesce((select jsonb_agg(g.code order by g.code) from granted g where not exists(select 1 from denied d where d.code=g.code)),'[]'::jsonb),
    'deniedPermissions',coalesce((select jsonb_agg(d.code order by d.code) from denied d),'[]'::jsonb),
    'context',jsonb_strip_nulls(jsonb_build_object('tenantId',r.tenant_id,'enterpriseId',r.enterprise_id,'mallId',r.mall_id,'supplierId',r.supplier_id,'userId',r.context_user_id)),
    'scopeBindings',coalesce((select jsonb_agg(jsonb_build_object('kind',s.scope_kind,'resourceId',s.resource_id) order by s.scope_kind,s.resource_id) from public.membership_scopes s where s.membership_id=r.id),'[]'::jsonb),
    'expiresAt',r.expires_at,'authzVersion',r.authz_version,
    'actor',jsonb_build_object('tenantId',r.tenant_id,'enterpriseId',r.enterprise_id,'mallId',r.mall_id,'mallCode',r.mall_code,'userId',r.context_user_id,'employeeNo',r.employee_no)
  ) from resolved r;
$$;

revoke all on function public.api_resolve_membership_context(text,text,text) from public,anon,authenticated;
grant execute on function public.api_resolve_membership_context(text,text,text) to service_role;

create or replace function public.prevent_owner_membership_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if exists (
    select 1 from public.membership_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.membership_id = old.id and r.is_owner and mr.revoked_at is null
  ) and (new.status is distinct from old.status or new.expires_at is distinct from old.expires_at) then
    raise exception 'OWNER_MEMBERSHIP_PROTECTED';
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_protect_owner on public.memberships;
create trigger memberships_protect_owner before update on public.memberships
for each row execute function public.prevent_owner_membership_mutation();

create or replace function public.prevent_owner_role_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare target_role public.roles%rowtype;
begin
  select * into target_role from public.roles where id = coalesce(new.role_id, old.role_id);
  if target_role.is_owner then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists membership_roles_protect_owner on public.membership_roles;
create trigger membership_roles_protect_owner before insert or update or delete on public.membership_roles
for each row execute function public.prevent_owner_role_mutation();

create or replace function public.api_permission_command_center(
  p_actor_membership_id text, p_tenant_id text, p_enterprise_id text, p_mall_id text, p_include_pii boolean default false
) returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with actor as (
    select ms.id from public.memberships ms
    where ms.id = p_actor_membership_id and ms.tenant_id = p_tenant_id
      and ms.enterprise_id = p_enterprise_id and ms.target = 'admin' and ms.status = 'active'
  ), members_data as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'membershipId', ms.id, 'memberId', ms.member_id, 'displayName', u.display_name,
      'employeeNo', u.employee_no, 'email', case when p_include_pii then u.email else null end,
      'mobileMasked', case when p_include_pii then u.mobile_masked else null end,
      'target', ms.target, 'status', ms.status, 'authzVersion', ms.authz_version,
      'isSelf', ms.id = p_actor_membership_id,
      'isOwner', exists(select 1 from public.membership_roles omr join public.roles orole on orole.id = omr.role_id where omr.membership_id = ms.id and omr.revoked_at is null and orole.is_owner),
      'roles', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name) order by r.sort_order, r.name)
        from public.membership_roles mr join public.roles r on r.id = mr.role_id
        where mr.membership_id = ms.id and mr.revoked_at is null and (mr.expires_at is null or mr.expires_at > now())), '[]'::jsonb),
      'scopes', coalesce((select jsonb_agg(jsonb_build_object('kind', s.scope_kind, 'resourceId', s.resource_id) order by s.scope_kind, s.resource_id)
        from public.membership_scopes s where s.membership_id = ms.id), '[]'::jsonb),
      'deniedPermissions', coalesce((select jsonb_agg(p.code order by p.code)
        from public.membership_permission_overrides mpo join public.permissions p on p.id = mpo.permission_id
        where mpo.membership_id = ms.id and mpo.effect = 'deny' and mpo.revoked_at is null and (mpo.expires_at is null or mpo.expires_at > now())), '[]'::jsonb)
    ) order by case when exists(select 1 from public.membership_roles xmr join public.roles xr on xr.id=xmr.role_id where xmr.membership_id=ms.id and xmr.revoked_at is null and xr.is_owner) then 0 else 1 end, u.display_name), '[]'::jsonb) value
    from public.memberships ms join public.members m on m.id = ms.member_id join public.users u on u.id = m.user_id
    where ms.tenant_id = p_tenant_id and ms.enterprise_id = p_enterprise_id and (ms.mall_id is null or ms.mall_id = p_mall_id)
      and (
        exists(select 1 from public.membership_scopes actor_tenant where actor_tenant.membership_id=p_actor_membership_id and actor_tenant.scope_kind='tenant' and actor_tenant.resource_id=p_tenant_id)
        or exists(select 1 from public.membership_scopes actor_enterprise where actor_enterprise.membership_id=p_actor_membership_id and actor_enterprise.scope_kind='enterprise' and actor_enterprise.resource_id=ms.enterprise_id)
        or exists(select 1 from public.membership_scopes actor_mall where actor_mall.membership_id=p_actor_membership_id and actor_mall.scope_kind='mall' and actor_mall.resource_id=ms.mall_id)
        or ms.id=p_actor_membership_id
      )
  )
  select jsonb_build_object(
    'members', members_data.value,
    'roles', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'code', r.code, 'name', r.name, 'description', r.description,
      'isSystem', r.is_system, 'isOwner', r.is_owner, 'isEditable', r.is_editable,
      'permissions', coalesce((select jsonb_agg(p.code order by p.code) from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=r.id), '[]'::jsonb)
    ) order by r.sort_order, r.name) from public.roles r where r.tenant_id=p_tenant_id), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(jsonb_build_object('code', p.code, 'name', p.name, 'category', p.category, 'risk', p.risk_level, 'mvp', p.is_mvp) order by p.category, p.code) from public.permissions p), '[]'::jsonb),
    'scopeOptions', jsonb_build_object(
      'tenant', case when exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='tenant' and actor_scope.resource_id=p_tenant_id) then jsonb_build_array(jsonb_build_object('id',p_tenant_id,'name','Smart Wing 平台')) else '[]'::jsonb end,
      'enterprise', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name)) from public.enterprises e where e.tenant_id=p_tenant_id and (
        exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='tenant' and actor_scope.resource_id=p_tenant_id)
        or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='enterprise' and actor_scope.resource_id=e.id))), '[]'::jsonb),
      'mall', coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name)) from public.malls m where m.tenant_id=p_tenant_id and (
        exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='tenant' and actor_scope.resource_id=p_tenant_id)
        or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='enterprise' and actor_scope.resource_id=m.enterprise_id)
        or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='mall' and actor_scope.resource_id=m.id))), '[]'::jsonb),
      'supplier', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)) from public.suppliers s where s.tenant_id=p_tenant_id and (
        exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='tenant' and actor_scope.resource_id=p_tenant_id)
        or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='supplier' and actor_scope.resource_id=s.id))), '[]'::jsonb),
      'department', coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name)) from public.departments d where d.tenant_id=p_tenant_id and d.enterprise_id=p_enterprise_id and (
        exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='tenant' and actor_scope.resource_id=p_tenant_id)
        or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='enterprise' and actor_scope.resource_id=d.enterprise_id)
        or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='department' and actor_scope.resource_id=d.id))), '[]'::jsonb)
    )
  ) from actor cross join members_data;
$$;

create or replace function public.api_update_membership_access(
  p_actor_membership_id text, p_actor_user_id text, p_tenant_id text, p_enterprise_id text, p_mall_id text,
  p_target_membership_id text, p_role_ids text[], p_scopes jsonb, p_denied_permission_codes text[],
  p_reason text, p_request_id text, p_user_agent text, p_granted_via jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target public.memberships%rowtype;
  scope_item jsonb;
  target_is_owner boolean;
  actor_is_owner boolean;
  role_id text;
  permission_id text;
begin
  if length(trim(coalesce(p_reason, ''))) < 4 then raise exception 'ACCESS_CHANGE_REASON_REQUIRED'; end if;
  if p_target_membership_id = p_actor_membership_id then raise exception 'SELF_ACCESS_MUTATION_FORBIDDEN'; end if;
  select * into target from public.memberships where id=p_target_membership_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id for update;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=target.id and mr.revoked_at is null and r.is_owner) into target_is_owner;
  if target_is_owner then raise exception 'OWNER_MEMBERSHIP_PROTECTED'; end if;
  if exists(select 1 from public.roles r where r.id=any(coalesce(p_role_ids,'{}')) and (r.tenant_id<>p_tenant_id or r.is_owner)) then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  if exists(select 1 from unnest(coalesce(p_role_ids,'{}')) requested where not exists(select 1 from public.roles r where r.id=requested and r.tenant_id=p_tenant_id)) then raise exception 'ROLE_NOT_FOUND'; end if;
  if exists(select 1 from unnest(coalesce(p_denied_permission_codes,'{}')) requested where not exists(select 1 from public.permissions p where p.code=requested)) then raise exception 'PERMISSION_NOT_FOUND'; end if;

  select exists(
    select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id
    where mr.membership_id=p_actor_membership_id and mr.revoked_at is null
      and (mr.expires_at is null or mr.expires_at>now()) and r.is_owner
  ) into actor_is_owner;

  if not actor_is_owner and not (
    exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='tenant' and actor_scope.resource_id=p_tenant_id)
    or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='enterprise' and actor_scope.resource_id=target.enterprise_id)
    or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='mall' and actor_scope.resource_id=target.mall_id)
  ) then raise exception 'TARGET_MEMBERSHIP_OUTSIDE_ACTOR_SCOPE'; end if;

  -- A delegated administrator may only pass on permissions they effectively
  -- hold. Explicit denies on the actor always subtract from that ceiling.
  if not actor_is_owner and exists(
    select 1 from public.roles requested_role
    join public.role_permissions requested_grant on requested_grant.role_id=requested_role.id
    where requested_role.id=any(coalesce(p_role_ids,'{}'))
      and (
        not exists(
          select 1 from public.membership_roles actor_role
          join public.role_permissions actor_grant on actor_grant.role_id=actor_role.role_id
          where actor_role.membership_id=p_actor_membership_id
            and actor_role.revoked_at is null
            and (actor_role.expires_at is null or actor_role.expires_at>now())
            and actor_grant.permission_id=requested_grant.permission_id
        )
        or exists(
          select 1 from public.membership_permission_overrides actor_deny
          where actor_deny.membership_id=p_actor_membership_id
            and actor_deny.permission_id=requested_grant.permission_id
            and actor_deny.effect='deny' and actor_deny.revoked_at is null
            and (actor_deny.expires_at is null or actor_deny.expires_at>now())
        )
      )
  ) then raise exception 'ROLE_GRANT_EXCEEDS_ACTOR'; end if;

  -- Tenant Owner may delegate anywhere in the tenant. Other administrators
  -- can grant their exact scopes, or child mall/department scopes beneath an
  -- enterprise scope they already manage.
  if not actor_is_owner and exists(
    select 1 from jsonb_array_elements(coalesce(p_scopes,'[]'::jsonb)) requested_scope
    where not (
      exists(
        select 1 from public.membership_scopes actor_scope
        where actor_scope.membership_id=p_actor_membership_id
          and actor_scope.scope_kind='tenant' and actor_scope.resource_id=p_tenant_id
      )
      or exists(
        select 1 from public.membership_scopes actor_scope
        where actor_scope.membership_id=p_actor_membership_id
          and actor_scope.scope_kind=requested_scope->>'kind'
          and actor_scope.resource_id=requested_scope->>'resourceId'
      )
      or ((requested_scope->>'kind')='mall' and exists(
        select 1 from public.malls child
        join public.membership_scopes actor_scope
          on actor_scope.membership_id=p_actor_membership_id
         and actor_scope.scope_kind='enterprise'
         and actor_scope.resource_id=child.enterprise_id
        where child.id=requested_scope->>'resourceId' and child.tenant_id=p_tenant_id
      ))
      or ((requested_scope->>'kind')='department' and exists(
        select 1 from public.departments child
        join public.membership_scopes actor_scope
          on actor_scope.membership_id=p_actor_membership_id
         and actor_scope.scope_kind='enterprise'
         and actor_scope.resource_id=child.enterprise_id
        where child.id=requested_scope->>'resourceId' and child.tenant_id=p_tenant_id
      ))
    )
  ) then raise exception 'SCOPE_GRANT_EXCEEDS_ACTOR'; end if;

  update public.membership_roles set revoked_at=now() where membership_id=target.id and revoked_at is null;
  foreach role_id in array coalesce(p_role_ids,'{}') loop
    insert into public.membership_roles(membership_id,role_id,granted_by_membership_id,granted_at,expires_at,revoked_at)
    values(target.id,role_id,p_actor_membership_id,now(),null,null)
    on conflict on constraint membership_roles_pkey do update set granted_by_membership_id=excluded.granted_by_membership_id,granted_at=now(),expires_at=null,revoked_at=null;
  end loop;

  delete from public.membership_scopes where membership_id=target.id;
  for scope_item in select value from jsonb_array_elements(coalesce(p_scopes,'[]'::jsonb)) loop
    insert into public.membership_scopes(membership_id,scope_kind,resource_id) values(target.id,scope_item->>'kind',scope_item->>'resourceId');
  end loop;

  update public.membership_permission_overrides set revoked_at=now() where membership_id=target.id and effect='deny' and revoked_at is null;
  for permission_id in select p.id from public.permissions p where p.code=any(coalesce(p_denied_permission_codes,'{}')) loop
    insert into public.membership_permission_overrides(membership_id,permission_id,effect,granted_by_membership_id,reason,revoked_at)
    values(target.id,permission_id,'deny',p_actor_membership_id,trim(p_reason),null)
    on conflict on constraint membership_permission_overrides_pkey do update set effect='deny',granted_by_membership_id=p_actor_membership_id,reason=trim(p_reason),expires_at=null,revoked_at=null,created_at=now();
  end loop;

  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','membership.access.updated','membership',target.id,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('roleIds',coalesce(p_role_ids,'{}'),'scopes',coalesce(p_scopes,'[]'::jsonb),'deniedPermissions',coalesce(p_denied_permission_codes,'{}'),'reason',trim(p_reason)),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('membershipId',target.id,'authzVersion',(select authz_version from public.memberships where id=target.id));
end;
$$;

create or replace function public.api_update_membership_status(
  p_actor_membership_id text, p_actor_user_id text, p_tenant_id text, p_enterprise_id text, p_mall_id text,
  p_target_membership_id text, p_status text, p_reason text, p_request_id text, p_user_agent text, p_granted_via jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.memberships%rowtype; actor_is_owner boolean;
begin
  if p_status not in ('active','suspended','offboarded') then raise exception 'MEMBERSHIP_STATUS_INVALID'; end if;
  if length(trim(coalesce(p_reason,'')))<4 then raise exception 'ACCESS_CHANGE_REASON_REQUIRED'; end if;
  if p_target_membership_id=p_actor_membership_id then raise exception 'SELF_ACCESS_MUTATION_FORBIDDEN'; end if;
  select * into target from public.memberships where id=p_target_membership_id and tenant_id=p_tenant_id and enterprise_id=p_enterprise_id for update;
  if not found then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;
  select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=p_actor_membership_id and mr.revoked_at is null and r.is_owner) into actor_is_owner;
  if not actor_is_owner and not (
    exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='tenant' and actor_scope.resource_id=p_tenant_id)
    or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='enterprise' and actor_scope.resource_id=target.enterprise_id)
    or exists(select 1 from public.membership_scopes actor_scope where actor_scope.membership_id=p_actor_membership_id and actor_scope.scope_kind='mall' and actor_scope.resource_id=target.mall_id)
  ) then raise exception 'TARGET_MEMBERSHIP_OUTSIDE_ACTOR_SCOPE'; end if;
  if exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where mr.membership_id=target.id and mr.revoked_at is null and r.is_owner) then raise exception 'OWNER_MEMBERSHIP_PROTECTED'; end if;
  update public.memberships set status=p_status where id=target.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,before_json,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','membership.status.updated','membership',target.id,p_request_id,left(coalesce(p_user_agent,''),300),
    jsonb_build_object('status',target.status),jsonb_build_object('status',p_status,'reason',trim(p_reason)),p_actor_membership_id,p_granted_via);
  return jsonb_build_object('membershipId',target.id,'status',p_status,'authzVersion',(select authz_version from public.memberships where id=target.id));
end;
$$;

create or replace function public.api_record_step_up(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_enterprise_id text,p_mall_id text,p_request_id text,p_user_agent text
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.memberships ms where ms.id=p_actor_membership_id and ms.context_user_id=p_actor_user_id and ms.tenant_id=p_tenant_id and ms.status='active') then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,resource_type,resource_id,request_id,user_agent,after_json,membership_id,granted_via)
  values(gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_actor_user_id,'admin','auth.step_up.succeeded','membership',p_actor_membership_id,p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object('verifiedAt',now()),p_actor_membership_id,jsonb_build_object('method','current_password'));
  return true;
end;
$$;

revoke all on function public.api_permission_command_center(text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.api_update_membership_access(text,text,text,text,text,text,text[],jsonb,text[],text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_update_membership_status(text,text,text,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.api_record_step_up(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.api_permission_command_center(text,text,text,text,boolean) to service_role;
grant execute on function public.api_update_membership_access(text,text,text,text,text,text,text[],jsonb,text[],text,text,text,jsonb) to service_role;
grant execute on function public.api_update_membership_status(text,text,text,text,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_record_step_up(text,text,text,text,text,text,text) to service_role;
