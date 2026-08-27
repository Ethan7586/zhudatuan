-- Commercial resource graph and employee storefront qualification engine.
--
-- This migration deliberately keeps administrative RBAC separate from
-- storefront qualification. The browser never decides visibility, purchase
-- eligibility, city-zone access, or purchase limits.

-- ---------------------------------------------------------------------------
-- 1. Dedicated management permissions
-- ---------------------------------------------------------------------------

insert into public.permissions (id, code, name, category, risk_level, is_mvp)
values
  ('permission-commercial-resource-read', 'commercial_resource.read', '查看商业资源关系', '商业资源', 'low', true),
  ('permission-commercial-resource-manage', 'commercial_resource.manage', '管理商业资源关系', '商业资源', 'high', true),
  ('permission-entitlement-read', 'entitlement.read', '查看员工资格策略', '员工资格', 'low', true),
  ('permission-entitlement-manage', 'entitlement.manage', '管理员工资格策略', '员工资格', 'high', true),
  ('permission-purchase-limit-read', 'purchase_limit.read', '查看限售模板', '员工资格', 'low', true),
  ('permission-purchase-limit-manage', 'purchase_limit.manage', '管理限售模板', '员工资格', 'high', true)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  risk_level = excluded.risk_level,
  is_mvp = excluded.is_mvp;

-- A newly introduced high-impact permission is never silently granted to an
-- ordinary role. The unique protected owner receives it so the system remains
-- operable; delegated grants are made explicitly in the permission center.
insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
cross join public.permissions permission
where role.is_owner
  and permission.code in (
    'commercial_resource.read', 'commercial_resource.manage',
    'entitlement.read', 'entitlement.manage',
    'purchase_limit.read', 'purchase_limit.manage'
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Commercial resources are a graph, not an organization tree
-- ---------------------------------------------------------------------------

create table if not exists public.brands (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  code text not null,
  name text not null,
  status text not null default 'active' check (status in ('draft','active','disabled')),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.stores (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  code text not null,
  name text not null,
  store_type text not null default 'offline' check (store_type in ('online','offline','hybrid')),
  province_code text,
  city_code text,
  address_text text,
  status text not null default 'active' check (status in ('draft','active','disabled')),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

alter table public.products add column if not exists brand_id text references public.brands(id) on delete restrict;

create table if not exists public.supplier_brand_bindings (
  tenant_id text not null references public.tenants(id) on delete restrict,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  brand_id text not null references public.brands(id) on delete cascade,
  relationship_kind text not null default 'authorized' check (relationship_kind in ('owner','authorized','distributor')),
  starts_at timestamptz,
  ends_at timestamptz,
  evidence_json jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence_json) = 'object'),
  status text not null default 'active' check (status in ('draft','active','expired','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (supplier_id, brand_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.brand_store_bindings (
  tenant_id text not null references public.tenants(id) on delete restrict,
  brand_id text not null references public.brands(id) on delete cascade,
  store_id text not null references public.stores(id) on delete cascade,
  relationship_kind text not null default 'authorized' check (relationship_kind in ('owned','authorized','franchise')),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active' check (status in ('draft','active','expired','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (brand_id, store_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.mall_supplier_agreements (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete restrict,
  agreement_code text not null,
  settlement_mode text not null default 'manual',
  starts_at timestamptz,
  ends_at timestamptz,
  terms_json jsonb not null default '{}'::jsonb check (jsonb_typeof(terms_json) = 'object'),
  status text not null default 'active' check (status in ('draft','active','expired','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mall_id, supplier_id),
  unique (tenant_id, agreement_code),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.mall_brand_authorizations (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  mall_id text not null references public.malls(id) on delete cascade,
  brand_id text not null references public.brands(id) on delete restrict,
  starts_at timestamptz,
  ends_at timestamptz,
  evidence_json jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence_json) = 'object'),
  status text not null default 'active' check (status in ('draft','active','expired','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mall_id, brand_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.store_org_unit_bindings (
  tenant_id text not null references public.tenants(id) on delete restrict,
  store_id text not null references public.stores(id) on delete cascade,
  org_unit_id text not null references public.org_units(id) on delete cascade,
  service_kind text not null default 'fulfillment' check (service_kind in ('fulfillment','verification','service')),
  status text not null default 'active' check (status in ('active','disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (store_id, org_unit_id, service_kind),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- Product pools model upstream source pools, a mall's selected pool, and
-- combined pools without moving the product row between owners.
create table if not exists public.catalog_pools (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  owner_kind text not null check (owner_kind in ('platform','distributor','enterprise','mall','supplier')),
  owner_id text not null,
  code text not null,
  name text not null,
  pool_kind text not null check (pool_kind in ('source','selected','combined')),
  status text not null default 'draft' check (status in ('draft','active','disabled')),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.catalog_pool_items (
  pool_id text not null references public.catalog_pools(id) on delete cascade,
  tenant_id text not null references public.tenants(id) on delete restrict,
  sku_id text not null references public.skus(id) on delete cascade,
  status text not null default 'active' check (status in ('active','disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  primary key (pool_id, sku_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.mall_catalog_pool_bindings (
  mall_id text not null references public.malls(id) on delete cascade,
  pool_id text not null references public.catalog_pools(id) on delete cascade,
  tenant_id text not null references public.tenants(id) on delete restrict,
  listing_kind text not null default 'selected' check (listing_kind in ('selected','combined')),
  status text not null default 'active' check (status in ('active','disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (mall_id, pool_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- Preserve today's catalogue after the stricter relationship model is
-- introduced. New products must be deliberately placed into an active pool.
insert into public.mall_supplier_agreements (
  id, tenant_id, mall_id, supplier_id, agreement_code, settlement_mode, status
)
select
  'agreement-bootstrap-' || product.mall_id || '-' || product.supplier_id,
  product.tenant_id,
  product.mall_id,
  product.supplier_id,
  'BOOTSTRAP-' || product.mall_id || '-' || product.supplier_id,
  supplier.settlement_mode,
  'active'
from public.products product
join public.suppliers supplier on supplier.id = product.supplier_id
group by product.tenant_id, product.mall_id, product.supplier_id, supplier.settlement_mode
on conflict (mall_id, supplier_id) do nothing;

insert into public.catalog_pools (id, tenant_id, owner_kind, owner_id, code, name, pool_kind, status)
select
  'pool-bootstrap-' || mall.id,
  mall.tenant_id,
  'mall',
  mall.id,
  'BOOTSTRAP-' || mall.code,
  mall.name || ' · 已选商品池',
  'selected',
  'active'
from public.malls mall
on conflict (tenant_id, code) do nothing;

insert into public.mall_catalog_pool_bindings (mall_id, pool_id, tenant_id, listing_kind, status)
select mall.id, pool.id, mall.tenant_id, 'selected', 'active'
from public.malls mall
join public.catalog_pools pool on pool.tenant_id = mall.tenant_id and pool.owner_kind = 'mall' and pool.owner_id = mall.id and pool.code = 'BOOTSTRAP-' || mall.code
on conflict do nothing;

insert into public.catalog_pool_items (pool_id, tenant_id, sku_id, status)
select pool.id, sku.tenant_id, sku.id, 'active'
from public.skus sku
join public.malls mall on mall.id = sku.mall_id
join public.catalog_pools pool on pool.tenant_id = mall.tenant_id and pool.owner_kind = 'mall' and pool.owner_id = mall.id and pool.code = 'BOOTSTRAP-' || mall.code
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Employee facts, city zones, visible/buyable policies, and limit templates
-- ---------------------------------------------------------------------------

create table if not exists public.employee_qualification_profiles (
  tenant_id text not null references public.tenants(id) on delete restrict,
  user_id text primary key references public.users(id) on delete cascade,
  city_code text,
  city_name text,
  status text not null default 'active' check (status in ('active','disabled')),
  attributes_json jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes_json) = 'object'),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_qualification_tags (
  tenant_id text not null references public.tenants(id) on delete restrict,
  user_id text not null references public.users(id) on delete cascade,
  tag_code text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  primary key (user_id, tag_code),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.city_zones (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  mall_id text references public.malls(id) on delete cascade,
  code text not null,
  name text not null,
  applies_to text not null default 'both' check (applies_to in ('visible','purchasable','both')),
  status text not null default 'draft' check (status in ('draft','active','disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.city_zone_cities (
  zone_id text not null references public.city_zones(id) on delete cascade,
  city_code text not null,
  city_name text not null,
  city_key text not null,
  primary key (zone_id, city_code),
  unique (zone_id, city_key)
);

create table if not exists public.city_zone_catalog_items (
  zone_id text not null references public.city_zones(id) on delete cascade,
  tenant_id text not null references public.tenants(id) on delete restrict,
  product_id text references public.products(id) on delete cascade,
  sku_id text references public.skus(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((product_id is null) <> (sku_id is null))
);

create unique index if not exists city_zone_catalog_product_unique
on public.city_zone_catalog_items (zone_id, product_id) where product_id is not null and sku_id is null;
create unique index if not exists city_zone_catalog_sku_unique
on public.city_zone_catalog_items (zone_id, sku_id) where sku_id is not null;

create table if not exists public.entitlement_policies (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  mall_id text references public.malls(id) on delete cascade,
  name text not null,
  action text not null check (action in ('visible','purchasable')),
  effect text not null check (effect in ('allow','deny')),
  priority integer not null default 100 check (priority between 0 and 10000),
  reason_code text not null default 'POLICY_RULE',
  status text not null default 'draft' check (status in ('draft','active','disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  version bigint not null default 1 check (version > 0),
  conditions_json jsonb not null default '{}'::jsonb check (jsonb_typeof(conditions_json) = 'object'),
  created_by_membership_id text references public.memberships(id) on delete set null,
  updated_by_membership_id text references public.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.entitlement_policy_subjects (
  policy_id text not null references public.entitlement_policies(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('all','enterprise','department','user','membership','tag')),
  subject_id text not null,
  primary key (policy_id, subject_kind, subject_id),
  check ((subject_kind = 'all' and subject_id = '*') or subject_kind <> 'all')
);

create table if not exists public.entitlement_policy_resources (
  policy_id text not null references public.entitlement_policies(id) on delete cascade,
  resource_kind text not null check (resource_kind in ('all','catalog_pool','product','sku','city_zone')),
  resource_id text not null,
  primary key (policy_id, resource_kind, resource_id),
  check ((resource_kind = 'all' and resource_id = '*') or resource_kind <> 'all')
);

create table if not exists public.purchase_limit_templates (
  id text primary key,
  tenant_id text not null references public.tenants(id) on delete restrict,
  mall_id text references public.malls(id) on delete cascade,
  code text not null,
  name text not null,
  count_scope text not null default 'sku' check (count_scope in ('sku','product')),
  max_per_order_qty integer check (max_per_order_qty is null or max_per_order_qty > 0),
  max_daily_qty integer check (max_daily_qty is null or max_daily_qty > 0),
  max_monthly_qty integer check (max_monthly_qty is null or max_monthly_qty > 0),
  max_lifetime_qty integer check (max_lifetime_qty is null or max_lifetime_qty > 0),
  max_per_order_amount_cents bigint check (max_per_order_amount_cents is null or max_per_order_amount_cents > 0),
  max_daily_amount_cents bigint check (max_daily_amount_cents is null or max_daily_amount_cents > 0),
  max_monthly_amount_cents bigint check (max_monthly_amount_cents is null or max_monthly_amount_cents > 0),
  max_lifetime_amount_cents bigint check (max_lifetime_amount_cents is null or max_lifetime_amount_cents > 0),
  status text not null default 'draft' check (status in ('draft','active','disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  version bigint not null default 1 check (version > 0),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (
    max_per_order_qty is not null or max_daily_qty is not null or max_monthly_qty is not null or max_lifetime_qty is not null or
    max_per_order_amount_cents is not null or max_daily_amount_cents is not null or max_monthly_amount_cents is not null or max_lifetime_amount_cents is not null
  )
);

create table if not exists public.purchase_limit_subjects (
  template_id text not null references public.purchase_limit_templates(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('all','enterprise','department','user','membership','tag')),
  subject_id text not null,
  primary key (template_id, subject_kind, subject_id),
  check ((subject_kind = 'all' and subject_id = '*') or subject_kind <> 'all')
);

create table if not exists public.purchase_limit_resources (
  template_id text not null references public.purchase_limit_templates(id) on delete cascade,
  resource_kind text not null check (resource_kind in ('all','catalog_pool','product','sku','city_zone')),
  resource_id text not null,
  primary key (template_id, resource_kind, resource_id),
  check ((resource_kind = 'all' and resource_id = '*') or resource_kind <> 'all')
);

create index if not exists catalog_pool_items_sku_lookup on public.catalog_pool_items (sku_id, status, pool_id);
create index if not exists mall_catalog_pool_active_lookup on public.mall_catalog_pool_bindings (mall_id, status, pool_id);
create index if not exists city_zone_items_sku_lookup on public.city_zone_catalog_items (sku_id, zone_id);
create index if not exists city_zone_items_product_lookup on public.city_zone_catalog_items (product_id, zone_id);
create index if not exists entitlement_policies_active_lookup on public.entitlement_policies (tenant_id, action, effect, status, priority desc);
create index if not exists entitlement_policy_resources_lookup on public.entitlement_policy_resources (resource_kind, resource_id, policy_id);
create index if not exists employee_qualification_tags_lookup on public.employee_qualification_tags (tenant_id, tag_code, user_id);
create index if not exists purchase_limit_templates_active_lookup on public.purchase_limit_templates (tenant_id, status);
create index if not exists order_items_qualification_usage on public.order_items (sku_id, product_id, order_id);
create index if not exists orders_qualification_usage on public.orders (tenant_id, mall_id, user_id, created_at, status);

-- Every graph edge repeats tenant_id as a query and audit fast-path. These
-- triggers make that denormalisation safe and reject cross-tenant bindings.
create or replace function public.validate_commercial_resource_tenant()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'products' then
    if new.brand_id is not null and not exists (select 1 from public.brands where id = new.brand_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'supplier_brand_bindings' then
    if not exists (select 1 from public.suppliers where id = new.supplier_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.brands where id = new.brand_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'brand_store_bindings' then
    if not exists (select 1 from public.brands where id = new.brand_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.stores where id = new.store_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'mall_supplier_agreements' then
    if not exists (select 1 from public.malls where id = new.mall_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.suppliers where id = new.supplier_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'mall_brand_authorizations' then
    if not exists (select 1 from public.malls where id = new.mall_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.brands where id = new.brand_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'store_org_unit_bindings' then
    if not exists (select 1 from public.stores where id = new.store_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.org_units where id = new.org_unit_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'catalog_pool_items' then
    if not exists (select 1 from public.catalog_pools where id = new.pool_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.skus where id = new.sku_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'mall_catalog_pool_bindings' then
    if not exists (select 1 from public.malls where id = new.mall_id and tenant_id = new.tenant_id)
      or not exists (select 1 from public.catalog_pools where id = new.pool_id and tenant_id = new.tenant_id) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  elsif tg_table_name in ('employee_qualification_profiles','employee_qualification_tags') then
    if not exists (select 1 from public.users where id = new.user_id and tenant_id = new.tenant_id) then raise exception 'QUALIFICATION_SUBJECT_TENANT_MISMATCH'; end if;
  elsif tg_table_name = 'city_zone_catalog_items' then
    if not exists (select 1 from public.city_zones where id = new.zone_id and tenant_id = new.tenant_id)
      or (new.product_id is not null and not exists (select 1 from public.products where id = new.product_id and tenant_id = new.tenant_id))
      or (new.sku_id is not null and not exists (select 1 from public.skus where id = new.sku_id and tenant_id = new.tenant_id)) then raise exception 'COMMERCIAL_RESOURCE_TENANT_MISMATCH'; end if;
  end if;
  return new;
end;
$$;

create trigger products_validate_brand_tenant before insert or update of tenant_id, brand_id on public.products for each row execute function public.validate_commercial_resource_tenant();
create trigger supplier_brand_bindings_validate_tenant before insert or update on public.supplier_brand_bindings for each row execute function public.validate_commercial_resource_tenant();
create trigger brand_store_bindings_validate_tenant before insert or update on public.brand_store_bindings for each row execute function public.validate_commercial_resource_tenant();
create trigger mall_supplier_agreements_validate_tenant before insert or update on public.mall_supplier_agreements for each row execute function public.validate_commercial_resource_tenant();
create trigger mall_brand_authorizations_validate_tenant before insert or update on public.mall_brand_authorizations for each row execute function public.validate_commercial_resource_tenant();
create trigger store_org_unit_bindings_validate_tenant before insert or update on public.store_org_unit_bindings for each row execute function public.validate_commercial_resource_tenant();
create trigger catalog_pool_items_validate_tenant before insert or update on public.catalog_pool_items for each row execute function public.validate_commercial_resource_tenant();
create trigger mall_catalog_pool_bindings_validate_tenant before insert or update on public.mall_catalog_pool_bindings for each row execute function public.validate_commercial_resource_tenant();
create trigger employee_qualification_profiles_validate_tenant before insert or update on public.employee_qualification_profiles for each row execute function public.validate_commercial_resource_tenant();
create trigger employee_qualification_tags_validate_tenant before insert or update on public.employee_qualification_tags for each row execute function public.validate_commercial_resource_tenant();
create trigger city_zone_catalog_items_validate_tenant before insert or update on public.city_zone_catalog_items for each row execute function public.validate_commercial_resource_tenant();

create or replace function public.validate_qualification_selector()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare v_tenant_id text; v_kind text; v_id text;
begin
  if tg_table_name like 'entitlement_policy_%' then
    select tenant_id into v_tenant_id from public.entitlement_policies where id = new.policy_id;
  else
    select tenant_id into v_tenant_id from public.purchase_limit_templates where id = new.template_id;
  end if;
  if v_tenant_id is null then raise exception 'QUALIFICATION_PARENT_NOT_FOUND'; end if;
  if tg_table_name in ('entitlement_policy_subjects','purchase_limit_subjects') then
    v_kind := new.subject_kind; v_id := new.subject_id;
    if v_kind = 'all' then return new; end if;
    if v_kind = 'enterprise' and not exists (select 1 from public.enterprises where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_SUBJECT_TENANT_MISMATCH'; end if;
    if v_kind = 'department' and not exists (select 1 from public.departments where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_SUBJECT_TENANT_MISMATCH'; end if;
    if v_kind = 'user' and not exists (select 1 from public.users where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_SUBJECT_TENANT_MISMATCH'; end if;
    if v_kind = 'membership' and not exists (select 1 from public.memberships where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_SUBJECT_TENANT_MISMATCH'; end if;
    if v_kind = 'tag' and trim(v_id) = '' then raise exception 'QUALIFICATION_SUBJECT_INVALID'; end if;
  else
    v_kind := new.resource_kind; v_id := new.resource_id;
    if v_kind = 'all' then return new; end if;
    if v_kind = 'catalog_pool' and not exists (select 1 from public.catalog_pools where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_RESOURCE_TENANT_MISMATCH'; end if;
    if v_kind = 'product' and not exists (select 1 from public.products where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_RESOURCE_TENANT_MISMATCH'; end if;
    if v_kind = 'sku' and not exists (select 1 from public.skus where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_RESOURCE_TENANT_MISMATCH'; end if;
    if v_kind = 'city_zone' and not exists (select 1 from public.city_zones where id = v_id and tenant_id = v_tenant_id) then raise exception 'QUALIFICATION_RESOURCE_TENANT_MISMATCH'; end if;
  end if;
  return new;
end;
$$;

create trigger entitlement_policy_subjects_validate before insert or update on public.entitlement_policy_subjects for each row execute function public.validate_qualification_selector();
create trigger entitlement_policy_resources_validate before insert or update on public.entitlement_policy_resources for each row execute function public.validate_qualification_selector();
create trigger purchase_limit_subjects_validate before insert or update on public.purchase_limit_subjects for each row execute function public.validate_qualification_selector();
create trigger purchase_limit_resources_validate before insert or update on public.purchase_limit_resources for each row execute function public.validate_qualification_selector();

-- ---------------------------------------------------------------------------
-- 4. Server-only selector and qualification functions
-- ---------------------------------------------------------------------------

create or replace function public.api_qualification_subject_matches(
  p_subject_kind text,
  p_subject_id text,
  p_tenant_id text,
  p_enterprise_id text,
  p_user_id text,
  p_membership_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_department_id text;
begin
  if p_subject_kind = 'all' then return p_subject_id = '*'; end if;
  if p_subject_kind = 'enterprise' then return p_subject_id = p_enterprise_id; end if;
  if p_subject_kind = 'user' then return p_subject_id = p_user_id; end if;
  if p_subject_kind = 'membership' then return p_subject_id = p_membership_id; end if;
  if p_subject_kind = 'tag' then
    return exists (
      select 1 from public.employee_qualification_tags tag
      where tag.tenant_id = p_tenant_id and tag.user_id = p_user_id and tag.tag_code = p_subject_id
        and (tag.starts_at is null or tag.starts_at <= now())
        and (tag.ends_at is null or tag.ends_at > now())
    );
  end if;
  if p_subject_kind = 'department' then
    select department_id into v_department_id from public.users
    where id = p_user_id and tenant_id = p_tenant_id and enterprise_id = p_enterprise_id;
    if v_department_id is null then return false; end if;
    return exists (
      select 1
      from public.org_units subject_department
      join public.org_units actor_department
        on actor_department.source_type = 'department' and actor_department.source_id = v_department_id
      join public.org_unit_closure path
        on path.ancestor_id = subject_department.id and path.descendant_id = actor_department.id
      where subject_department.source_type = 'department'
        and subject_department.source_id = p_subject_id
        and subject_department.tenant_id = p_tenant_id
    );
  end if;
  return false;
end;
$$;

create or replace function public.api_qualification_resource_matches(
  p_resource_kind text,
  p_resource_id text,
  p_tenant_id text,
  p_mall_id text,
  p_product_id text,
  p_sku_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_resource_kind = 'all' then return p_resource_id = '*'; end if;
  if p_resource_kind = 'product' then return p_resource_id = p_product_id; end if;
  if p_resource_kind = 'sku' then return p_resource_id = p_sku_id; end if;
  if p_resource_kind = 'catalog_pool' then
    return exists (
      select 1 from public.catalog_pool_items item
      join public.catalog_pools pool on pool.id = item.pool_id
      where item.pool_id = p_resource_id and item.sku_id = p_sku_id
        and item.tenant_id = p_tenant_id and item.status = 'active' and pool.status = 'active'
        and (item.starts_at is null or item.starts_at <= now())
        and (item.ends_at is null or item.ends_at > now())
    );
  end if;
  if p_resource_kind = 'city_zone' then
    return exists (
      select 1 from public.city_zone_catalog_items item
      join public.city_zones zone on zone.id = item.zone_id
      where item.zone_id = p_resource_id and item.tenant_id = p_tenant_id
        and (item.sku_id = p_sku_id or (item.sku_id is null and item.product_id = p_product_id))
        and zone.status = 'active'
        and (zone.starts_at is null or zone.starts_at <= now())
        and (zone.ends_at is null or zone.ends_at > now())
    );
  end if;
  return false;
end;
$$;

create or replace function public.api_employee_sku_qualification(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text,
  p_membership_id text,
  p_sku_id text,
  p_quantity integer default 1,
  p_city_code text default null,
  p_city_name text default null,
  p_order_items jsonb default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sku public.skus%rowtype;
  v_product public.products%rowtype;
  v_profile public.employee_qualification_profiles%rowtype;
  v_city_code text;
  v_city_key text;
  v_visible boolean := true;
  v_purchasable boolean := true;
  v_visibility_reason text := 'ALLOWED';
  v_purchase_reason text := 'ALLOWED';
  v_visible_allow_defined boolean := false;
  v_visible_allow_matched boolean := false;
  v_visible_deny_matched boolean := false;
  v_purchase_allow_defined boolean := false;
  v_purchase_allow_matched boolean := false;
  v_purchase_deny_matched boolean := false;
  v_visible_zone_ids text[] := '{}'::text[];
  v_purchase_zone_ids text[] := '{}'::text[];
  v_policy_ids text[] := '{}'::text[];
  v_limit_ids text[] := '{}'::text[];
  v_policy_version bigint := 0;
  v_unit_amount bigint := 0;
  v_used_qty bigint := 0;
  v_used_amount bigint := 0;
  v_requested_qty bigint := 0;
  v_requested_amount bigint := 0;
  v_template public.purchase_limit_templates%rowtype;
begin
  if not exists (
    select 1 from public.memberships membership
    where membership.id = p_membership_id and membership.tenant_id = p_tenant_id
      and membership.enterprise_id = p_enterprise_id and membership.mall_id = p_mall_id
      and membership.context_user_id = p_user_id and membership.target = 'storefront'
      and membership.status = 'active' and (membership.expires_at is null or membership.expires_at > now())
      and exists (
        select 1 from public.users qualification_user
        where qualification_user.id = membership.context_user_id
          and qualification_user.tenant_id = membership.tenant_id
          and qualification_user.status = 'active'
      )
  ) then
    return jsonb_build_object('visible', false, 'purchasable', false, 'visibilityReason', 'MEMBERSHIP_INACTIVE', 'purchaseReason', 'MEMBERSHIP_INACTIVE');
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    return jsonb_build_object('visible', false, 'purchasable', false, 'visibilityReason', 'INVALID_QUANTITY', 'purchaseReason', 'INVALID_QUANTITY');
  end if;

  select * into v_sku from public.skus
  where id = p_sku_id and tenant_id = p_tenant_id and mall_id = p_mall_id and status = 'active';
  if not found then
    return jsonb_build_object('visible', false, 'purchasable', false, 'visibilityReason', 'SKU_NOT_AVAILABLE', 'purchaseReason', 'SKU_NOT_AVAILABLE');
  end if;
  select * into v_product from public.products
  where id = v_sku.product_id and tenant_id = p_tenant_id and mall_id = p_mall_id and status = 'active';
  if not found then
    return jsonb_build_object('visible', false, 'purchasable', false, 'visibilityReason', 'SKU_NOT_AVAILABLE', 'purchaseReason', 'SKU_NOT_AVAILABLE');
  end if;
  v_unit_amount := v_sku.price_cents;

  -- Listing, supplier agreement and optional brand authorization are all
  -- required commercial facts. Existing rows are bootstrapped above.
  if not exists (
    select 1
    from public.catalog_pool_items item
    join public.catalog_pools pool on pool.id = item.pool_id
    join public.mall_catalog_pool_bindings binding on binding.pool_id = pool.id
    where item.sku_id = v_sku.id and item.tenant_id = p_tenant_id and item.status = 'active'
      and pool.status = 'active' and binding.mall_id = p_mall_id and binding.tenant_id = p_tenant_id and binding.status = 'active'
      and (item.starts_at is null or item.starts_at <= now()) and (item.ends_at is null or item.ends_at > now())
      and (binding.starts_at is null or binding.starts_at <= now()) and (binding.ends_at is null or binding.ends_at > now())
  ) or not exists (
    select 1 from public.mall_supplier_agreements agreement
    where agreement.tenant_id = p_tenant_id and agreement.mall_id = p_mall_id and agreement.supplier_id = v_product.supplier_id
      and agreement.status = 'active'
      and (agreement.starts_at is null or agreement.starts_at <= now())
      and (agreement.ends_at is null or agreement.ends_at > now())
  ) then
    return jsonb_build_object('visible', false, 'purchasable', false, 'visibilityReason', 'COMMERCIAL_RESOURCE_NOT_LISTED', 'purchaseReason', 'COMMERCIAL_RESOURCE_NOT_LISTED');
  end if;

  if v_product.brand_id is not null and (
    not exists (
      select 1 from public.supplier_brand_bindings binding
      where binding.tenant_id = p_tenant_id and binding.supplier_id = v_product.supplier_id and binding.brand_id = v_product.brand_id
        and binding.status = 'active' and (binding.starts_at is null or binding.starts_at <= now()) and (binding.ends_at is null or binding.ends_at > now())
    ) or not exists (
      select 1 from public.mall_brand_authorizations brand_auth
      where brand_auth.tenant_id = p_tenant_id and brand_auth.mall_id = p_mall_id and brand_auth.brand_id = v_product.brand_id
        and brand_auth.status = 'active' and (brand_auth.starts_at is null or brand_auth.starts_at <= now()) and (brand_auth.ends_at is null or brand_auth.ends_at > now())
    )
  ) then
    return jsonb_build_object('visible', false, 'purchasable', false, 'visibilityReason', 'BRAND_NOT_AUTHORIZED', 'purchaseReason', 'BRAND_NOT_AUTHORIZED');
  end if;

  select * into v_profile from public.employee_qualification_profiles
  where tenant_id = p_tenant_id and user_id = p_user_id and status = 'active';
  v_city_code := coalesce(nullif(trim(p_city_code), ''), v_profile.city_code);
  v_city_key := lower(regexp_replace(regexp_replace(trim(coalesce(nullif(p_city_name, ''), v_profile.city_name, '')), '[[:space:]]+', '', 'g'), '市$', ''));

  select coalesce(array_agg(distinct zone.id), '{}'::text[]) into v_visible_zone_ids
  from public.city_zone_catalog_items item
  join public.city_zones zone on zone.id = item.zone_id
  where item.tenant_id = p_tenant_id and zone.status = 'active' and zone.applies_to in ('visible','both')
    and (item.sku_id = v_sku.id or (item.sku_id is null and item.product_id = v_product.id))
    and (zone.starts_at is null or zone.starts_at <= now()) and (zone.ends_at is null or zone.ends_at > now());

  if cardinality(v_visible_zone_ids) > 0 and not exists (
    select 1 from public.city_zone_cities city
    where city.zone_id = any(v_visible_zone_ids)
      and ((v_city_code is not null and city.city_code = v_city_code) or (v_city_key <> '' and city.city_key = v_city_key))
  ) then
    v_visible := false;
    v_visibility_reason := 'CITY_NOT_VISIBLE';
  end if;

  select
    coalesce(bool_or(policy.effect = 'allow'), false),
    coalesce(bool_or(policy.effect = 'allow' and exists (
      select 1 from public.entitlement_policy_subjects subject
      where subject.policy_id = policy.id and public.api_qualification_subject_matches(subject.subject_kind, subject.subject_id, p_tenant_id, p_enterprise_id, p_user_id, p_membership_id)
    )), false),
    coalesce(bool_or(policy.effect = 'deny' and exists (
      select 1 from public.entitlement_policy_subjects subject
      where subject.policy_id = policy.id and public.api_qualification_subject_matches(subject.subject_kind, subject.subject_id, p_tenant_id, p_enterprise_id, p_user_id, p_membership_id)
    )), false),
    coalesce(array_agg(policy.id order by policy.priority desc, policy.id) filter (where exists (
      select 1 from public.entitlement_policy_subjects subject
      where subject.policy_id = policy.id and public.api_qualification_subject_matches(subject.subject_kind, subject.subject_id, p_tenant_id, p_enterprise_id, p_user_id, p_membership_id)
    )), '{}'::text[]),
    coalesce(max(policy.version), 0)
  into v_visible_allow_defined, v_visible_allow_matched, v_visible_deny_matched, v_policy_ids, v_policy_version
  from public.entitlement_policies policy
  where policy.tenant_id = p_tenant_id and (policy.mall_id is null or policy.mall_id = p_mall_id)
    and policy.action = 'visible' and policy.status = 'active'
    and (policy.starts_at is null or policy.starts_at <= now()) and (policy.ends_at is null or policy.ends_at > now())
    and exists (
      select 1 from public.entitlement_policy_resources resource
      where resource.policy_id = policy.id and public.api_qualification_resource_matches(resource.resource_kind, resource.resource_id, p_tenant_id, p_mall_id, v_product.id, v_sku.id)
    );

  if v_visible and v_visible_deny_matched then
    v_visible := false;
    v_visibility_reason := 'VISIBILITY_EXPLICITLY_DENIED';
  elsif v_visible and v_visible_allow_defined and not v_visible_allow_matched then
    v_visible := false;
    v_visibility_reason := 'VISIBILITY_ALLOW_NOT_MATCHED';
  end if;

  if not v_visible then
    return jsonb_build_object(
      'visible', false, 'purchasable', false,
      'visibilityReason', v_visibility_reason, 'purchaseReason', v_visibility_reason,
      'policyVersion', v_policy_version, 'matchedPolicyIds', to_jsonb(v_policy_ids),
      'cityZoneIds', to_jsonb(v_visible_zone_ids), 'limitTemplateIds', '[]'::jsonb
    );
  end if;

  select coalesce(array_agg(distinct zone.id), '{}'::text[]) into v_purchase_zone_ids
  from public.city_zone_catalog_items item
  join public.city_zones zone on zone.id = item.zone_id
  where item.tenant_id = p_tenant_id and zone.status = 'active' and zone.applies_to in ('purchasable','both')
    and (item.sku_id = v_sku.id or (item.sku_id is null and item.product_id = v_product.id))
    and (zone.starts_at is null or zone.starts_at <= now()) and (zone.ends_at is null or zone.ends_at > now());

  if cardinality(v_purchase_zone_ids) > 0 and not exists (
    select 1 from public.city_zone_cities city
    where city.zone_id = any(v_purchase_zone_ids)
      and ((v_city_code is not null and city.city_code = v_city_code) or (v_city_key <> '' and city.city_key = v_city_key))
  ) then
    v_purchasable := false;
    v_purchase_reason := 'CITY_NOT_PURCHASABLE';
  end if;

  select
    coalesce(bool_or(policy.effect = 'allow'), false),
    coalesce(bool_or(policy.effect = 'allow' and exists (
      select 1 from public.entitlement_policy_subjects subject
      where subject.policy_id = policy.id and public.api_qualification_subject_matches(subject.subject_kind, subject.subject_id, p_tenant_id, p_enterprise_id, p_user_id, p_membership_id)
    )), false),
    coalesce(bool_or(policy.effect = 'deny' and exists (
      select 1 from public.entitlement_policy_subjects subject
      where subject.policy_id = policy.id and public.api_qualification_subject_matches(subject.subject_kind, subject.subject_id, p_tenant_id, p_enterprise_id, p_user_id, p_membership_id)
    )), false)
  into v_purchase_allow_defined, v_purchase_allow_matched, v_purchase_deny_matched
  from public.entitlement_policies policy
  where policy.tenant_id = p_tenant_id and (policy.mall_id is null or policy.mall_id = p_mall_id)
    and policy.action = 'purchasable' and policy.status = 'active'
    and (policy.starts_at is null or policy.starts_at <= now()) and (policy.ends_at is null or policy.ends_at > now())
    and exists (
      select 1 from public.entitlement_policy_resources resource
      where resource.policy_id = policy.id and public.api_qualification_resource_matches(resource.resource_kind, resource.resource_id, p_tenant_id, p_mall_id, v_product.id, v_sku.id)
    );

  select coalesce(v_policy_ids, '{}'::text[]) || coalesce(array_agg(policy.id order by policy.priority desc, policy.id) filter (where exists (
    select 1 from public.entitlement_policy_subjects subject
    where subject.policy_id = policy.id and public.api_qualification_subject_matches(subject.subject_kind, subject.subject_id, p_tenant_id, p_enterprise_id, p_user_id, p_membership_id)
  )), '{}'::text[]), greatest(v_policy_version, coalesce(max(policy.version), 0))
  into v_policy_ids, v_policy_version
  from public.entitlement_policies policy
  where policy.tenant_id = p_tenant_id and (policy.mall_id is null or policy.mall_id = p_mall_id)
    and policy.action = 'purchasable' and policy.status = 'active'
    and (policy.starts_at is null or policy.starts_at <= now()) and (policy.ends_at is null or policy.ends_at > now())
    and exists (
      select 1 from public.entitlement_policy_resources resource
      where resource.policy_id = policy.id and public.api_qualification_resource_matches(resource.resource_kind, resource.resource_id, p_tenant_id, p_mall_id, v_product.id, v_sku.id)
    );

  if v_purchasable and v_purchase_deny_matched then
    v_purchasable := false;
    v_purchase_reason := 'PURCHASE_EXPLICITLY_DENIED';
  elsif v_purchasable and v_purchase_allow_defined and not v_purchase_allow_matched then
    v_purchasable := false;
    v_purchase_reason := 'PURCHASE_ALLOW_NOT_MATCHED';
  end if;

  if v_purchasable then
    for v_template in
      select template.*
      from public.purchase_limit_templates template
      where template.tenant_id = p_tenant_id and (template.mall_id is null or template.mall_id = p_mall_id)
        and template.status = 'active'
        and (template.starts_at is null or template.starts_at <= now()) and (template.ends_at is null or template.ends_at > now())
        and exists (
          select 1 from public.purchase_limit_subjects subject
          where subject.template_id = template.id and public.api_qualification_subject_matches(subject.subject_kind, subject.subject_id, p_tenant_id, p_enterprise_id, p_user_id, p_membership_id)
        )
        and exists (
          select 1 from public.purchase_limit_resources resource
          where resource.template_id = template.id and public.api_qualification_resource_matches(resource.resource_kind, resource.resource_id, p_tenant_id, p_mall_id, v_product.id, v_sku.id)
        )
      order by template.id
    loop
      v_limit_ids := array_append(v_limit_ids, v_template.id);
      v_requested_qty := p_quantity;
      v_requested_amount := v_unit_amount * p_quantity;
      if p_order_items is not null and jsonb_typeof(p_order_items) = 'array' then
        select coalesce(sum((item.value ->> 'quantity')::integer), 0),
          coalesce(sum((item.value ->> 'quantity')::integer * requested_sku.price_cents), 0)
        into v_requested_qty, v_requested_amount
        from jsonb_array_elements(p_order_items) item(value)
        join public.skus requested_sku on requested_sku.id = item.value ->> 'skuId'
        where (v_template.count_scope = 'sku' and requested_sku.id = v_sku.id)
          or (v_template.count_scope = 'product' and requested_sku.product_id = v_product.id);
      end if;
      if (v_template.max_per_order_qty is not null and v_requested_qty > v_template.max_per_order_qty)
        or (v_template.max_per_order_amount_cents is not null and v_requested_amount > v_template.max_per_order_amount_cents) then
        v_purchasable := false; v_purchase_reason := 'PURCHASE_LIMIT_EXCEEDED'; exit;
      end if;

      if v_template.max_daily_qty is not null or v_template.max_daily_amount_cents is not null then
        select coalesce(sum(item.quantity), 0), coalesce(sum(item.line_amount_cents), 0)
        into v_used_qty, v_used_amount
        from public.order_items item join public.orders purchase_order on purchase_order.id = item.order_id
        where purchase_order.tenant_id = p_tenant_id and purchase_order.mall_id = p_mall_id and purchase_order.user_id = p_user_id
          and purchase_order.status not in ('cancelled','refunded')
          and purchase_order.created_at >= (date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai')
          and ((v_template.count_scope = 'sku' and item.sku_id = v_sku.id) or (v_template.count_scope = 'product' and item.product_id = v_product.id));
        if (v_template.max_daily_qty is not null and v_used_qty + v_requested_qty > v_template.max_daily_qty)
          or (v_template.max_daily_amount_cents is not null and v_used_amount + v_requested_amount > v_template.max_daily_amount_cents) then
          v_purchasable := false; v_purchase_reason := 'PURCHASE_LIMIT_EXCEEDED'; exit;
        end if;
      end if;

      if v_template.max_monthly_qty is not null or v_template.max_monthly_amount_cents is not null then
        select coalesce(sum(item.quantity), 0), coalesce(sum(item.line_amount_cents), 0)
        into v_used_qty, v_used_amount
        from public.order_items item join public.orders purchase_order on purchase_order.id = item.order_id
        where purchase_order.tenant_id = p_tenant_id and purchase_order.mall_id = p_mall_id and purchase_order.user_id = p_user_id
          and purchase_order.status not in ('cancelled','refunded')
          and purchase_order.created_at >= (date_trunc('month', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai')
          and ((v_template.count_scope = 'sku' and item.sku_id = v_sku.id) or (v_template.count_scope = 'product' and item.product_id = v_product.id));
        if (v_template.max_monthly_qty is not null and v_used_qty + v_requested_qty > v_template.max_monthly_qty)
          or (v_template.max_monthly_amount_cents is not null and v_used_amount + v_requested_amount > v_template.max_monthly_amount_cents) then
          v_purchasable := false; v_purchase_reason := 'PURCHASE_LIMIT_EXCEEDED'; exit;
        end if;
      end if;

      if v_template.max_lifetime_qty is not null or v_template.max_lifetime_amount_cents is not null then
        select coalesce(sum(item.quantity), 0), coalesce(sum(item.line_amount_cents), 0)
        into v_used_qty, v_used_amount
        from public.order_items item join public.orders purchase_order on purchase_order.id = item.order_id
        where purchase_order.tenant_id = p_tenant_id and purchase_order.mall_id = p_mall_id and purchase_order.user_id = p_user_id
          and purchase_order.status not in ('cancelled','refunded')
          and ((v_template.count_scope = 'sku' and item.sku_id = v_sku.id) or (v_template.count_scope = 'product' and item.product_id = v_product.id));
        if (v_template.max_lifetime_qty is not null and v_used_qty + v_requested_qty > v_template.max_lifetime_qty)
          or (v_template.max_lifetime_amount_cents is not null and v_used_amount + v_requested_amount > v_template.max_lifetime_amount_cents) then
          v_purchasable := false; v_purchase_reason := 'PURCHASE_LIMIT_EXCEEDED'; exit;
        end if;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'visible', true,
    'purchasable', v_purchasable,
    'visibilityReason', 'ALLOWED',
    'purchaseReason', v_purchase_reason,
    'policyVersion', v_policy_version,
    'matchedPolicyIds', to_jsonb(coalesce(v_policy_ids, '{}'::text[])),
    'cityZoneIds', to_jsonb(array(
      select distinct zone_id
      from unnest(coalesce(v_visible_zone_ids, '{}'::text[]) || coalesce(v_purchase_zone_ids, '{}'::text[])) zone_id
      order by zone_id
    )),
    'limitTemplateIds', to_jsonb(coalesce(v_limit_ids, '{}'::text[]))
  );
end;
$$;

-- Authenticated employee catalogue. Qualification is evaluated before the row
-- leaves PostgreSQL, so hidden products never reach browser memory.
create or replace function public.api_catalog_qualified(
  p_tenant_id text,
  p_enterprise_id text,
  p_mall_id text,
  p_user_id text,
  p_membership_id text,
  p_category text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id text, sku_id text, name text, name_en text, name_zh text,
  subtitle text, subtitle_en text, subtitle_zh text, category_code text,
  taxonomy_l1 text, taxonomy_l2 text, taxonomy_l3 text,
  classification_status text, cover_url text, price_cents bigint,
  market_price_cents bigint, available_stock integer, supplier_name text,
  is_test boolean, purchasable boolean, qualification jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select product.id, sku.id, coalesce(product.name_zh, product.name), product.name_en, product.name_zh,
    coalesce(product.subtitle_zh, product.subtitle), product.subtitle_en, product.subtitle_zh,
    product.taxonomy_l1, product.taxonomy_l1, product.taxonomy_l2, product.taxonomy_l3,
    product.classification_status, product.cover_url, sku.price_cents, sku.market_price_cents,
    inventory.available_qty - inventory.reserved_qty, supplier.name, product.is_test,
    coalesce((qualification.result ->> 'purchasable')::boolean, false), qualification.result
  from public.products product
  join public.skus sku on sku.product_id = product.id and sku.mall_id = product.mall_id
  join public.inventory inventory on inventory.sku_id = sku.id and inventory.mall_id = product.mall_id
  join public.suppliers supplier on supplier.id = product.supplier_id
  cross join lateral public.api_employee_sku_qualification(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_membership_id, sku.id, 1, null, null
  ) qualification(result)
  where product.tenant_id = p_tenant_id and product.mall_id = p_mall_id
    and (p_category is null or product.taxonomy_l1 = p_category)
    and public.is_valid_catalog_taxonomy_path(product.taxonomy_l1, product.taxonomy_l2, product.taxonomy_l3)
    and product.classification_confidence >= 0.8
    and product.status = 'active' and sku.status = 'active'
    and coalesce((qualification.result ->> 'visible')::boolean, false)
  order by product.created_at desc, sku.id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

create or replace function public.api_upsert_cart_item_qualified(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_membership_id text, p_sku_id text, p_quantity integer, p_selected boolean, p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_qualification jsonb;
begin
  v_qualification := public.api_employee_sku_qualification(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_membership_id, p_sku_id, p_quantity, null, null
  );
  if not coalesce((v_qualification ->> 'purchasable')::boolean, false) then
    if v_qualification ->> 'purchaseReason' = 'PURCHASE_LIMIT_EXCEEDED' then raise exception 'PURCHASE_LIMIT_EXCEEDED'; end if;
    if v_qualification ->> 'purchaseReason' like 'CITY_%' then raise exception 'CITY_NOT_ELIGIBLE'; end if;
    raise exception 'SKU_NOT_ELIGIBLE';
  end if;
  return public.api_upsert_cart_item(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_sku_id, p_quantity, p_selected, p_request_id
  );
end;
$$;

create or replace function public.api_cart_items_qualified(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text, p_membership_id text
)
returns table(id text, sku_id text, product_id text, quantity integer, selected boolean, updated_at timestamptz, purchasable boolean, qualification jsonb)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select item.id, item.sku_id, sku.product_id, item.quantity, item.selected, item.updated_at,
    coalesce((decision.result ->> 'purchasable')::boolean, false), decision.result
  from public.carts cart
  join public.cart_items item on item.cart_id = cart.id
  join public.skus sku on sku.id = item.sku_id
  cross join lateral public.api_employee_sku_qualification(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_membership_id, item.sku_id, item.quantity, null, null, null
  ) decision(result)
  where cart.tenant_id = p_tenant_id and cart.mall_id = p_mall_id and cart.user_id = p_user_id
  order by item.updated_at desc;
$$;

alter table public.orders add column if not exists qualification_evidence_json jsonb not null default '{}'::jsonb;

create or replace function public.api_assert_order_qualification(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_membership_id text, p_items jsonb, p_recipient_city text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_item jsonb; v_lock_key text; v_quantity integer; v_qualification jsonb; v_evidence jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_ORDER_INPUT';
  end if;
  -- Validate first, then lock SKU and product counters in a stable order. The
  -- product lock is what makes an across-SKU SPU limit safe under concurrency.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'skuId') or not (v_item ? 'quantity') or (v_item ->> 'quantity') !~ '^[1-9][0-9]?$' then
      raise exception 'INVALID_ORDER_INPUT';
    end if;
  end loop;
  for v_lock_key in
    select lock_key
    from (
      select 'sku:' || (item.value ->> 'skuId') as lock_key
      from jsonb_array_elements(p_items) item(value)
      union
      select 'product:' || sku.product_id as lock_key
      from jsonb_array_elements(p_items) item(value)
      join public.skus sku on sku.id = item.value ->> 'skuId'
    ) locks
    order by lock_key
  loop
    perform pg_advisory_xact_lock(hashtextextended(p_tenant_id || ':' || p_user_id || ':' || v_lock_key, 0));
  end loop;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    v_qualification := public.api_employee_sku_qualification(
      p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_membership_id,
      v_item ->> 'skuId', v_quantity, null, p_recipient_city, p_items
    );
    if not coalesce((v_qualification ->> 'purchasable')::boolean, false) then
      if v_qualification ->> 'purchaseReason' = 'PURCHASE_LIMIT_EXCEEDED' then raise exception 'PURCHASE_LIMIT_EXCEEDED'; end if;
      if v_qualification ->> 'purchaseReason' like 'CITY_%' then raise exception 'CITY_NOT_ELIGIBLE'; end if;
      raise exception 'SKU_NOT_ELIGIBLE';
    end if;
    v_evidence := v_evidence || jsonb_build_array(jsonb_build_object(
      'skuId', v_item ->> 'skuId',
      'quantity', v_quantity,
      'policyVersion', v_qualification -> 'policyVersion',
      'policyIds', v_qualification -> 'matchedPolicyIds',
      'cityZoneIds', v_qualification -> 'cityZoneIds',
      'limitTemplateIds', v_qualification -> 'limitTemplateIds'
    ));
  end loop;
  return jsonb_build_object('evaluatedAt', now(), 'items', v_evidence);
end;
$$;

drop function if exists public.api_create_order_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,jsonb);
create function public.api_create_order_authorized(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_items jsonb, p_recipient_cipher jsonb, p_recipient_city text, p_idempotency_key text,
  p_request_hash text, p_request_id text, p_user_agent text,
  p_membership_id text, p_granted_via jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb; v_order_id text; v_qualification jsonb; v_existing public.idempotency_keys%rowtype;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then raise exception 'INVALID_ORDER_INPUT'; end if;
  -- Serialize retries before reading the idempotency row. This preserves the
  -- original response even when a concurrent first request consumes a limit.
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id || ':' || p_mall_id || ':order:create:' || p_idempotency_key, 0
  ));
  select * into v_existing from public.idempotency_keys
  where mall_id = p_mall_id and scope = 'order:create'
    and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  v_qualification := public.api_assert_order_qualification(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_membership_id, p_items, p_recipient_city
  );
  v_result := public.api_create_order(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_items, p_recipient_cipher,
    p_idempotency_key, p_request_hash, p_request_id, p_user_agent
  );
  v_order_id := v_result #>> '{order,id}';
  if v_order_id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  update public.orders set qualification_evidence_json = v_qualification where id = v_order_id;
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json, membership_id, granted_via, created_at
  )
  select gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, 'user',
    'order.create.authorized', 'order', v_order_id, p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('idempotencyKey', p_idempotency_key, 'qualification', v_qualification),
    p_membership_id, p_granted_via, now()
  where not exists (
    select 1 from public.audit_logs
    where resource_id = v_order_id and action = 'order.create.authorized'
      and after_json ->> 'idempotencyKey' = p_idempotency_key
  );
  return v_result || jsonb_build_object('qualification', v_qualification);
end;
$$;

-- Admin read model for the first qualification-center UI. It intentionally
-- excludes employee tag values and other sensitive subject facts.
create or replace function public.api_qualification_center(
  p_tenant_id text,
  p_mall_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'catalogPools', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pool.id, 'code', pool.code, 'name', pool.name, 'kind', pool.pool_kind,
        'status', pool.status, 'itemCount', (select count(*) from public.catalog_pool_items item where item.pool_id = pool.id and item.status = 'active')
      ) order by pool.updated_at desc)
      from public.catalog_pools pool
      where pool.tenant_id = p_tenant_id
        and (
          pool.owner_kind <> 'mall' or pool.owner_id = p_mall_id
          or exists (select 1 from public.mall_catalog_pool_bindings binding where binding.pool_id = pool.id and binding.mall_id = p_mall_id)
        )
    ), '[]'::jsonb),
    'cityZones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', zone.id, 'code', zone.code, 'name', zone.name, 'appliesTo', zone.applies_to,
        'status', zone.status, 'cityCount', (select count(*) from public.city_zone_cities city where city.zone_id = zone.id),
        'itemCount', (select count(*) from public.city_zone_catalog_items item where item.zone_id = zone.id)
      ) order by zone.updated_at desc)
      from public.city_zones zone
      where zone.tenant_id = p_tenant_id
        and exists (
          select 1 from public.city_zone_catalog_items item
          left join public.products product on product.id = item.product_id
          left join public.skus sku on sku.id = item.sku_id
          where item.zone_id = zone.id and coalesce(product.mall_id, sku.mall_id) = p_mall_id
        )
    ), '[]'::jsonb),
    'policies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', policy.id, 'name', policy.name, 'action', policy.action, 'effect', policy.effect,
        'priority', policy.priority, 'status', policy.status, 'version', policy.version,
        'subjectCount', (select count(*) from public.entitlement_policy_subjects subject where subject.policy_id = policy.id),
        'resourceCount', (select count(*) from public.entitlement_policy_resources resource where resource.policy_id = policy.id)
      ) order by policy.priority desc, policy.updated_at desc)
      from public.entitlement_policies policy
      where policy.tenant_id = p_tenant_id
        and exists (
          select 1 from public.entitlement_policy_resources resource
          where resource.policy_id = policy.id
            and (
              resource.resource_kind = 'all'
              or (resource.resource_kind = 'catalog_pool' and exists (select 1 from public.mall_catalog_pool_bindings binding where binding.pool_id = resource.resource_id and binding.mall_id = p_mall_id))
              or (resource.resource_kind = 'product' and exists (select 1 from public.products product where product.id = resource.resource_id and product.mall_id = p_mall_id))
              or (resource.resource_kind = 'sku' and exists (select 1 from public.skus sku where sku.id = resource.resource_id and sku.mall_id = p_mall_id))
              or (resource.resource_kind = 'city_zone' and exists (
                select 1 from public.city_zone_catalog_items item
                left join public.products product on product.id = item.product_id
                left join public.skus sku on sku.id = item.sku_id
                where item.zone_id = resource.resource_id and coalesce(product.mall_id, sku.mall_id) = p_mall_id
              ))
            )
        )
    ), '[]'::jsonb),
    'limitTemplates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', template.id, 'code', template.code, 'name', template.name,
        'countScope', template.count_scope, 'status', template.status, 'version', template.version,
        'maxPerOrderQty', template.max_per_order_qty, 'maxDailyQty', template.max_daily_qty,
        'maxMonthlyQty', template.max_monthly_qty, 'maxLifetimeQty', template.max_lifetime_qty
      ) order by template.updated_at desc)
      from public.purchase_limit_templates template
      where template.tenant_id = p_tenant_id
        and exists (
          select 1 from public.purchase_limit_resources resource
          where resource.template_id = template.id
            and (
              resource.resource_kind = 'all'
              or (resource.resource_kind = 'catalog_pool' and exists (select 1 from public.mall_catalog_pool_bindings binding where binding.pool_id = resource.resource_id and binding.mall_id = p_mall_id))
              or (resource.resource_kind = 'product' and exists (select 1 from public.products product where product.id = resource.resource_id and product.mall_id = p_mall_id))
              or (resource.resource_kind = 'sku' and exists (select 1 from public.skus sku where sku.id = resource.resource_id and sku.mall_id = p_mall_id))
              or (resource.resource_kind = 'city_zone' and exists (
                select 1 from public.city_zone_catalog_items item
                left join public.products product on product.id = item.product_id
                left join public.skus sku on sku.id = item.sku_id
                where item.zone_id = resource.resource_id and coalesce(product.mall_id, sku.mall_id) = p_mall_id
              ))
            )
        )
    ), '[]'::jsonb),
    'commercialSummary', jsonb_build_object(
      'brands', (select count(*) from public.brands brand where brand.tenant_id = p_tenant_id),
      'stores', (select count(*) from public.stores store where store.tenant_id = p_tenant_id),
      'supplierAgreements', (select count(*) from public.mall_supplier_agreements agreement where agreement.tenant_id = p_tenant_id and agreement.mall_id = p_mall_id and agreement.status = 'active'),
      'brandAuthorizations', (select count(*) from public.mall_brand_authorizations brand_auth where brand_auth.tenant_id = p_tenant_id and brand_auth.mall_id = p_mall_id and brand_auth.status = 'active')
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS and service-only execution surface
-- ---------------------------------------------------------------------------

alter table public.brands enable row level security;
alter table public.stores enable row level security;
alter table public.supplier_brand_bindings enable row level security;
alter table public.brand_store_bindings enable row level security;
alter table public.mall_supplier_agreements enable row level security;
alter table public.mall_brand_authorizations enable row level security;
alter table public.store_org_unit_bindings enable row level security;
alter table public.catalog_pools enable row level security;
alter table public.catalog_pool_items enable row level security;
alter table public.mall_catalog_pool_bindings enable row level security;
alter table public.employee_qualification_profiles enable row level security;
alter table public.employee_qualification_tags enable row level security;
alter table public.city_zones enable row level security;
alter table public.city_zone_cities enable row level security;
alter table public.city_zone_catalog_items enable row level security;
alter table public.entitlement_policies enable row level security;
alter table public.entitlement_policy_subjects enable row level security;
alter table public.entitlement_policy_resources enable row level security;
alter table public.purchase_limit_templates enable row level security;
alter table public.purchase_limit_subjects enable row level security;
alter table public.purchase_limit_resources enable row level security;

revoke all on table
  public.brands, public.stores, public.supplier_brand_bindings, public.brand_store_bindings,
  public.mall_supplier_agreements, public.mall_brand_authorizations, public.store_org_unit_bindings,
  public.catalog_pools, public.catalog_pool_items, public.mall_catalog_pool_bindings,
  public.employee_qualification_profiles, public.employee_qualification_tags,
  public.city_zones, public.city_zone_cities, public.city_zone_catalog_items,
  public.entitlement_policies, public.entitlement_policy_subjects, public.entitlement_policy_resources,
  public.purchase_limit_templates, public.purchase_limit_subjects, public.purchase_limit_resources
from public, anon, authenticated;

revoke all on function public.api_qualification_subject_matches(text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_qualification_resource_matches(text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_employee_sku_qualification(text,text,text,text,text,text,integer,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.api_catalog_qualified(text,text,text,text,text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.api_upsert_cart_item_qualified(text,text,text,text,text,text,integer,boolean,text) from public, anon, authenticated;
revoke all on function public.api_cart_items_qualified(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_assert_order_qualification(text,text,text,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.api_create_order_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.api_qualification_center(text,text) from public, anon, authenticated;

grant execute on function public.api_employee_sku_qualification(text,text,text,text,text,text,integer,text,text,jsonb) to service_role;
grant execute on function public.api_catalog_qualified(text,text,text,text,text,text,integer,integer) to service_role;
grant execute on function public.api_upsert_cart_item_qualified(text,text,text,text,text,text,integer,boolean,text) to service_role;
grant execute on function public.api_cart_items_qualified(text,text,text,text,text) to service_role;
grant execute on function public.api_assert_order_qualification(text,text,text,text,text,jsonb,text) to service_role;
grant execute on function public.api_create_order_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_qualification_center(text,text) to service_role;
