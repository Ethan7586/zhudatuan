create extension if not exists pgcrypto;

create table public.tenants (
  id text primary key,
  code text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enterprises (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  code text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.malls (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  code text not null,
  public_slug text not null unique,
  name text not null,
  brand_name text not null default '智慧翼企业福利商城',
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.departments (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  parent_id text references public.departments(id),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (enterprise_id, code)
);

create table public.users (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  department_id text references public.departments(id),
  employee_no text not null,
  display_name text not null,
  email text,
  mobile_masked text,
  identity_subject text,
  status text not null default 'active' check (status in ('active', 'locked', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enterprise_id, employee_no),
  unique nulls not distinct (tenant_id, identity_subject)
);

create table public.roles (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  code text not null,
  name text not null,
  unique (tenant_id, code)
);

create table public.permissions (
  id text primary key,
  code text not null unique,
  name text not null
);

create table public.role_permissions (
  role_id text not null references public.roles(id) on delete cascade,
  permission_id text not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  tenant_id text not null references public.tenants(id),
  user_id text not null references public.users(id) on delete cascade,
  role_id text not null references public.roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table public.suppliers (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  code text not null,
  name text not null,
  settlement_mode text not null default 'manual',
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.products (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  supplier_id text not null references public.suppliers(id),
  spu_code text not null,
  name text not null,
  subtitle text,
  category_code text not null,
  cover_url text,
  detail_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mall_id, spu_code)
);

create table public.skus (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  product_id text not null references public.products(id),
  sku_code text not null,
  specs_json jsonb not null default '{}'::jsonb,
  price_cents bigint not null check (price_cents >= 0),
  market_price_cents bigint check (market_price_cents is null or market_price_cents >= price_cents),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mall_id, sku_code)
);

create table public.inventory (
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  sku_id text primary key references public.skus(id),
  available_qty integer not null default 0 check (available_qty >= 0),
  reserved_qty integer not null default 0 check (reserved_qty >= 0 and reserved_qty <= available_qty),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.welfare_accounts (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  mall_id text not null references public.malls(id),
  user_id text not null references public.users(id),
  account_type text not null check (account_type in ('welfare', 'meal')),
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  version bigint not null default 0,
  status text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  updated_at timestamptz not null default now(),
  unique (mall_id, user_id, account_type)
);

create table public.account_ledgers (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  account_id text not null references public.welfare_accounts(id),
  user_id text not null references public.users(id),
  direction text not null check (direction in ('credit', 'debit')),
  amount_cents bigint not null check (amount_cents > 0),
  balance_after_cents bigint not null check (balance_after_cents >= 0),
  business_type text not null,
  business_id text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (account_id, idempotency_key)
);

create table public.carts (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  user_id text not null references public.users(id),
  updated_at timestamptz not null default now(),
  unique (mall_id, user_id)
);

create table public.cart_items (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  cart_id text not null references public.carts(id) on delete cascade,
  sku_id text not null references public.skus(id),
  quantity integer not null check (quantity > 0),
  selected boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, sku_id)
);

create table public.orders (
  id text primary key,
  order_no text not null unique,
  tenant_id text not null references public.tenants(id),
  enterprise_id text not null references public.enterprises(id),
  mall_id text not null references public.malls(id),
  user_id text not null references public.users(id),
  status text not null check (status in ('pending_payment', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refund_pending', 'refunded')),
  goods_amount_cents bigint not null check (goods_amount_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  payable_cents bigint not null check (payable_cents >= 0),
  paid_cents bigint not null default 0 check (paid_cents >= 0 and paid_cents <= payable_cents),
  recipient_snapshot_json jsonb not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.sub_orders (
  id text primary key,
  sub_order_no text not null unique,
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  parent_order_id text not null references public.orders(id),
  supplier_id text not null references public.suppliers(id),
  status text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  order_id text not null references public.orders(id),
  sub_order_id text not null references public.sub_orders(id),
  product_id text not null references public.products(id),
  sku_id text not null references public.skus(id),
  product_name_snapshot text not null,
  specs_snapshot_json jsonb not null,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  line_amount_cents bigint not null check (line_amount_cents >= 0)
);

create table public.payments (
  id text primary key,
  payment_no text not null unique,
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  user_id text not null references public.users(id),
  order_id text not null references public.orders(id),
  channel text not null check (channel in ('welfare', 'meal', 'wechat', 'alipay', 'unionpay', 'manual')),
  status text not null check (status in ('created', 'processing', 'succeeded', 'failed', 'closed', 'refunded')),
  amount_cents bigint not null check (amount_cents > 0),
  provider_trade_no text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (mall_id, idempotency_key)
);

create table public.payment_allocations (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  payment_id text not null references public.payments(id),
  order_id text not null references public.orders(id),
  account_id text references public.welfare_accounts(id),
  channel text not null,
  amount_cents bigint not null check (amount_cents > 0)
);

create table public.refunds (
  id text primary key,
  refund_no text not null unique,
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  order_id text not null references public.orders(id),
  payment_id text references public.payments(id),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null check (status in ('created', 'processing', 'succeeded', 'failed')),
  reason text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (mall_id, idempotency_key)
);

create table public.after_sales (
  id text primary key,
  after_sale_no text not null unique,
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  user_id text not null references public.users(id),
  order_id text not null references public.orders(id),
  order_item_id text references public.order_items(id),
  type text not null check (type in ('refund_only', 'return_refund', 'exchange')),
  status text not null check (status in ('submitted', 'reviewing', 'approved', 'rejected', 'returning', 'completed', 'closed')),
  reason text not null,
  requested_amount_cents bigint not null check (requested_amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  enterprise_id text,
  mall_id text,
  actor_user_id text,
  actor_type text not null check (actor_type in ('user', 'admin', 'system', 'supplier')),
  action text not null,
  resource_type text not null,
  resource_id text,
  request_id text not null,
  ip_hash text,
  user_agent text,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create table public.idempotency_keys (
  tenant_id text not null references public.tenants(id),
  mall_id text not null references public.malls(id),
  scope text not null,
  idempotency_key text not null,
  request_hash text not null,
  resource_id text,
  response_json jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (mall_id, scope, idempotency_key)
);

create index idx_enterprises_tenant on public.enterprises (tenant_id);
create index idx_malls_tenant_enterprise on public.malls (tenant_id, enterprise_id);
create index idx_users_tenant_enterprise on public.users (tenant_id, enterprise_id);
create index idx_products_catalog on public.products (tenant_id, mall_id, status, category_code);
create index idx_skus_product on public.skus (tenant_id, mall_id, product_id, status);
create index idx_inventory_scope on public.inventory (tenant_id, mall_id, sku_id);
create index idx_accounts_owner on public.welfare_accounts (tenant_id, mall_id, user_id);
create index idx_ledger_business on public.account_ledgers (tenant_id, mall_id, business_type, business_id);
create index idx_orders_owner on public.orders (tenant_id, mall_id, user_id, created_at desc);
create index idx_orders_status on public.orders (tenant_id, mall_id, status, created_at desc);
create index idx_sub_orders_parent on public.sub_orders (tenant_id, mall_id, parent_order_id);
create index idx_payments_order on public.payments (tenant_id, mall_id, order_id);
create index idx_after_sales_owner on public.after_sales (tenant_id, mall_id, user_id, created_at desc);
create index idx_audit_scope on public.audit_logs (tenant_id, mall_id, created_at desc);

create or replace function public.reject_immutable_change()
returns trigger language plpgsql as $$
begin
  raise exception '%_IS_IMMUTABLE', tg_table_name;
end;
$$;

create trigger account_ledgers_immutable_update before update or delete on public.account_ledgers
for each row execute function public.reject_immutable_change();
create trigger audit_logs_immutable_update before update or delete on public.audit_logs
for each row execute function public.reject_immutable_change();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'tenants','enterprises','malls','departments','users','roles','permissions',
    'role_permissions','user_roles','suppliers','products','skus','inventory',
    'welfare_accounts','account_ledgers','carts','cart_items','orders','sub_orders',
    'order_items','payments','payment_allocations','refunds','after_sales',
    'audit_logs','idempotency_keys'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end $$;

create or replace function public.api_health()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'databaseReady', count(*) = 4,
    'tableCount', (select count(*) from pg_catalog.pg_tables where schemaname = 'public')
  )
  from pg_catalog.pg_tables
  where schemaname = 'public'
    and tablename in ('tenants', 'products', 'orders', 'audit_logs');
$$;

create or replace function public.api_catalog(
  p_mall_slug text,
  p_category text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id text, sku_id text, name text, subtitle text, category_code text,
  cover_url text, price_cents bigint, market_price_cents bigint,
  available_stock integer, supplier_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, s.id, p.name, p.subtitle, p.category_code, p.cover_url,
         s.price_cents, s.market_price_cents,
         i.available_qty - i.reserved_qty, supplier.name
  from public.products p
  join public.malls m on m.id = p.mall_id
  join public.skus s on s.product_id = p.id and s.mall_id = p.mall_id
  join public.inventory i on i.sku_id = s.id and i.mall_id = p.mall_id
  join public.suppliers supplier on supplier.id = p.supplier_id
  where m.public_slug = p_mall_slug
    and (p_category is null or p.category_code = p_category)
    and p.status = 'active' and s.status = 'active' and m.status = 'active'
  order by p.created_at desc, s.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.api_resolve_actor(p_employee_no text, p_mall_code text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with actor_scope as (
    select u.tenant_id, u.enterprise_id, m.id mall_id, m.code mall_code,
           u.id user_id, u.employee_no
    from public.users u
    join public.malls m on m.tenant_id = u.tenant_id and m.enterprise_id = u.enterprise_id
    where u.employee_no = p_employee_no and m.code = p_mall_code
      and u.status = 'active' and m.status = 'active'
    limit 1
  )
  select jsonb_build_object(
    'tenantId', a.tenant_id, 'enterpriseId', a.enterprise_id,
    'mallId', a.mall_id, 'mallCode', a.mall_code,
    'userId', a.user_id, 'employeeNo', a.employee_no,
    'roles', coalesce((select jsonb_agg(r.code order by r.code)
      from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.tenant_id = a.tenant_id and ur.user_id = a.user_id), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(distinct p.code)
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.tenant_id = a.tenant_id and ur.user_id = a.user_id), '[]'::jsonb)
  )
  from actor_scope a;
$$;

create or replace function public.api_bootstrap(
  p_tenant_id text, p_enterprise_id text, p_mall_id text
)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('mallName', m.name, 'brandName', m.brand_name, 'enterpriseName', e.name)
  from public.malls m join public.enterprises e on e.id = m.enterprise_id
  where m.tenant_id = p_tenant_id and m.id = p_mall_id and e.id = p_enterprise_id;
$$;

create or replace function public.api_accounts(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text
)
returns table(id text, account_type text, balance_cents bigint, status text, updated_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select a.id, a.account_type, a.balance_cents, a.status, a.updated_at
  from public.welfare_accounts a
  where a.tenant_id = p_tenant_id and a.enterprise_id = p_enterprise_id
    and a.mall_id = p_mall_id and a.user_id = p_user_id
  order by a.account_type;
$$;

create or replace function public.api_orders(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text
)
returns table(
  id text, order_no text, status text, goods_amount_cents bigint,
  discount_cents bigint, payable_cents bigint, paid_cents bigint,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select o.id, o.order_no, o.status, o.goods_amount_cents, o.discount_cents,
         o.payable_cents, o.paid_cents, o.created_at, o.updated_at
  from public.orders o
  where o.tenant_id = p_tenant_id and o.enterprise_id = p_enterprise_id
    and o.mall_id = p_mall_id and o.user_id = p_user_id
  order by o.created_at desc limit 100;
$$;

create or replace function public.api_create_order(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_items jsonb, p_recipient_cipher jsonb, p_idempotency_key text,
  p_request_hash text, p_request_id text, p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_order_id text := gen_random_uuid()::text;
  v_order_no text := 'SW' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') ||
                     upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_created_at timestamptz := clock_timestamp();
  v_goods bigint;
  v_item jsonb;
  v_sku record;
  v_supplier record;
  v_sub_order_id text;
  v_sub_order_no text;
  v_supplier_index integer := 0;
  v_response jsonb;
  v_changed integer;
begin
  select * into v_existing from public.idempotency_keys
  where mall_id = p_mall_id and scope = 'order:create'
    and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.response_json;
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_ORDER_INPUT';
  end if;

  select sum(s.price_cents * (x.item->>'quantity')::integer)
    into v_goods
  from jsonb_array_elements(p_items) x(item)
  join public.skus s on s.id = x.item->>'skuId'
  join public.products p on p.id = s.product_id
  where s.tenant_id = p_tenant_id and s.mall_id = p_mall_id
    and s.status = 'active' and p.status = 'active';
  if v_goods is null or (
    select count(*) from jsonb_array_elements(p_items)
  ) <> (
    select count(*) from jsonb_array_elements(p_items) x(item)
    join public.skus s on s.id = x.item->>'skuId'
    join public.products p on p.id = s.product_id
    where s.tenant_id = p_tenant_id and s.mall_id = p_mall_id
      and s.status = 'active' and p.status = 'active'
  ) then
    raise exception 'SKU_NOT_AVAILABLE';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    update public.inventory
      set reserved_qty = reserved_qty + (v_item->>'quantity')::integer,
          version = version + 1, updated_at = v_created_at
    where tenant_id = p_tenant_id and mall_id = p_mall_id
      and sku_id = v_item->>'skuId'
      and available_qty - reserved_qty >= (v_item->>'quantity')::integer;
    get diagnostics v_changed = row_count;
    if v_changed <> 1 then raise exception 'INSUFFICIENT_INVENTORY'; end if;
  end loop;

  insert into public.orders (
    id, order_no, tenant_id, enterprise_id, mall_id, user_id, status,
    goods_amount_cents, discount_cents, payable_cents, paid_cents,
    recipient_snapshot_json, created_at, updated_at
  ) values (
    v_order_id, v_order_no, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id,
    'pending_payment', v_goods, 0, v_goods, 0, p_recipient_cipher, v_created_at, v_created_at
  );

  for v_supplier in
    select distinct p.supplier_id
    from jsonb_array_elements(p_items) x(item)
    join public.skus s on s.id = x.item->>'skuId'
    join public.products p on p.id = s.product_id
  loop
    v_supplier_index := v_supplier_index + 1;
    v_sub_order_id := gen_random_uuid()::text;
    v_sub_order_no := v_order_no || '-' || lpad(v_supplier_index::text, 2, '0');
    insert into public.sub_orders (
      id, sub_order_no, tenant_id, mall_id, parent_order_id, supplier_id,
      status, amount_cents, created_at, updated_at
    )
    select v_sub_order_id, v_sub_order_no, p_tenant_id, p_mall_id, v_order_id,
           v_supplier.supplier_id, 'pending_payment',
           sum(s.price_cents * (x.item->>'quantity')::integer), v_created_at, v_created_at
    from jsonb_array_elements(p_items) x(item)
    join public.skus s on s.id = x.item->>'skuId'
    join public.products p on p.id = s.product_id
    where p.supplier_id = v_supplier.supplier_id;

    insert into public.order_items (
      id, tenant_id, mall_id, order_id, sub_order_id, product_id, sku_id,
      product_name_snapshot, specs_snapshot_json, unit_price_cents, quantity, line_amount_cents
    )
    select gen_random_uuid()::text, p_tenant_id, p_mall_id, v_order_id, v_sub_order_id,
           p.id, s.id, p.name, s.specs_json, s.price_cents,
           (x.item->>'quantity')::integer, s.price_cents * (x.item->>'quantity')::integer
    from jsonb_array_elements(p_items) x(item)
    join public.skus s on s.id = x.item->>'skuId'
    join public.products p on p.id = s.product_id
    where p.supplier_id = v_supplier.supplier_id;
  end loop;

  v_response := jsonb_build_object('order', jsonb_build_object(
    'id', v_order_id, 'orderNo', v_order_no, 'status', 'pending_payment',
    'goodsAmountCents', v_goods, 'discountCents', 0, 'payableCents', v_goods,
    'paidCents', 0, 'createdAt', v_created_at
  ), 'requestId', p_request_id);
  insert into public.idempotency_keys values (
    p_tenant_id, p_mall_id, 'order:create', p_idempotency_key, p_request_hash,
    v_order_id, v_response, v_created_at, v_created_at + interval '24 hours'
  );
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type,
    action, resource_type, resource_id, request_id, user_agent, after_json, created_at
  ) values (
    gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id,
    'user', 'order.create', 'order', v_order_id, p_request_id,
    left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('orderNo', v_order_no, 'goodsAmountCents', v_goods), v_created_at
  );
  return v_response;
end;
$$;

create or replace function public.api_pay_internal(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_order_id text, p_welfare_cents bigint, p_meal_cents bigint,
  p_idempotency_key text, p_request_hash text, p_request_id text, p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_order public.orders%rowtype;
  v_account public.welfare_accounts%rowtype;
  v_channel text;
  v_amount bigint;
  v_payment_no text;
  v_payment_nos jsonb := '[]'::jsonb;
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
  v_changed integer;
begin
  select * into v_existing from public.idempotency_keys
  where mall_id = p_mall_id and scope = 'payment:internal'
    and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;

  select * into v_order from public.orders
  where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id
    and mall_id = p_mall_id and user_id = p_user_id and id = p_order_id
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'pending_payment' or v_order.paid_cents <> 0 then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;
  if p_welfare_cents < 0 or p_meal_cents < 0
     or p_welfare_cents + p_meal_cents <> v_order.payable_cents then
    raise exception 'PAYMENT_TOTAL_MISMATCH';
  end if;

  for v_channel, v_amount in
    select * from (values ('welfare', p_welfare_cents), ('meal', p_meal_cents)) x(channel, amount)
    where amount > 0
  loop
    select * into v_account from public.welfare_accounts
    where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id
      and mall_id = p_mall_id and user_id = p_user_id and account_type = v_channel
    for update;
    if not found or v_account.status <> 'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
    update public.welfare_accounts
      set balance_cents = balance_cents - v_amount, version = version + 1, updated_at = v_now
    where id = v_account.id and balance_cents >= v_amount and status = 'active';
    get diagnostics v_changed = row_count;
    if v_changed <> 1 then raise exception 'INSUFFICIENT_ACCOUNT_BALANCE'; end if;

    v_payment_no := 'PAY' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') ||
                    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.account_ledgers (
      id, tenant_id, mall_id, account_id, user_id, direction, amount_cents,
      balance_after_cents, business_type, business_id, idempotency_key, created_at
    ) select gen_random_uuid()::text, p_tenant_id, p_mall_id, v_account.id, p_user_id,
      'debit', v_amount, balance_cents, 'order_payment', p_order_id,
      p_idempotency_key || ':' || v_channel, v_now
      from public.welfare_accounts where id = v_account.id;
    insert into public.payments (
      id, payment_no, tenant_id, mall_id, user_id, order_id, channel, status,
      amount_cents, idempotency_key, created_at, completed_at
    ) values (
      gen_random_uuid()::text, v_payment_no, p_tenant_id, p_mall_id, p_user_id,
      p_order_id, v_channel, 'succeeded', v_amount,
      p_idempotency_key || ':' || v_channel, v_now, v_now
    );
    v_payment_nos := v_payment_nos || jsonb_build_array(v_payment_no);
  end loop;

  update public.orders set paid_cents = payable_cents, status = 'paid',
    paid_at = v_now, updated_at = v_now where id = p_order_id;
  update public.sub_orders set status = 'paid', updated_at = v_now
    where tenant_id = p_tenant_id and mall_id = p_mall_id and parent_order_id = p_order_id;

  v_response := jsonb_build_object('payment', jsonb_build_object(
    'orderId', p_order_id, 'orderNo', v_order.order_no, 'paymentNos', v_payment_nos,
    'status', 'succeeded', 'amountCents', v_order.payable_cents, 'completedAt', v_now
  ), 'requestId', p_request_id);
  insert into public.idempotency_keys values (
    p_tenant_id, p_mall_id, 'payment:internal', p_idempotency_key, p_request_hash,
    p_order_id, v_response, v_now, v_now + interval '24 hours'
  );
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json, created_at
  ) values (
    gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id,
    'user', 'payment.internal.succeeded', 'order', p_order_id, p_request_id,
    left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('amountCents', v_order.payable_cents, 'paymentNos', v_payment_nos), v_now
  );
  return v_response;
end;
$$;

revoke all on function public.api_health() from public, anon, authenticated;
revoke all on function public.api_catalog(text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.api_resolve_actor(text,text) from public, anon, authenticated;
revoke all on function public.api_bootstrap(text,text,text) from public, anon, authenticated;
revoke all on function public.api_accounts(text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_orders(text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_create_order(text,text,text,text,jsonb,jsonb,text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_pay_internal(text,text,text,text,text,bigint,bigint,text,text,text,text) from public, anon, authenticated;

grant execute on function public.api_health() to service_role;
grant execute on function public.api_catalog(text,text,integer,integer) to service_role;
grant execute on function public.api_resolve_actor(text,text) to service_role;
grant execute on function public.api_bootstrap(text,text,text) to service_role;
grant execute on function public.api_accounts(text,text,text,text) to service_role;
grant execute on function public.api_orders(text,text,text,text) to service_role;
grant execute on function public.api_create_order(text,text,text,text,jsonb,jsonb,text,text,text,text) to service_role;
grant execute on function public.api_pay_internal(text,text,text,text,text,bigint,bigint,text,text,text,text) to service_role;

insert into public.tenants (id, code, name)
values ('tenant-smart-wing', 'SMART_WING', '智慧翼福利平台');
insert into public.enterprises (id, tenant_id, code, name)
values ('enterprise-demo', 'tenant-smart-wing', 'DEMO_ENTERPRISE', '示范企业');
insert into public.malls (id, tenant_id, enterprise_id, code, public_slug, name, brand_name)
values ('mall-demo', 'tenant-smart-wing', 'enterprise-demo', 'SMART_WING_DEMO',
        'smart-wing-demo', '智慧翼企业福利商城', '智慧翼企业福利商城');
insert into public.departments (id, tenant_id, enterprise_id, code, name)
values ('department-digital', 'tenant-smart-wing', 'enterprise-demo', 'DIGITAL', '数字化推进部');
insert into public.users (
  id, tenant_id, enterprise_id, department_id, employee_no, display_name, email
) values (
  'user-demo', 'tenant-smart-wing', 'enterprise-demo', 'department-digital',
  'SW0001', '演示员工', 'demo@example.invalid'
);
insert into public.roles (id, tenant_id, code, name) values
  ('role-employee', 'tenant-smart-wing', 'employee', '员工'),
  ('role-mall-admin', 'tenant-smart-wing', 'mall_admin', '商城管理员');
insert into public.permissions (id, code, name) values
  ('permission-catalog-read', 'catalog:read', '查看商品'),
  ('permission-order-create', 'order:create', '创建订单'),
  ('permission-order-read-own', 'order:read:own', '查看本人订单');
insert into public.role_permissions (role_id, permission_id) values
  ('role-employee', 'permission-catalog-read'),
  ('role-employee', 'permission-order-create'),
  ('role-employee', 'permission-order-read-own');
insert into public.user_roles (tenant_id, user_id, role_id)
values ('tenant-smart-wing', 'user-demo', 'role-employee');
insert into public.suppliers (id, tenant_id, code, name) values
  ('supplier-central', 'tenant-smart-wing', 'CENTRAL_SUPPLY', '央企供应链'),
  ('supplier-local', 'tenant-smart-wing', 'LOCAL_SERVICE', '本地生活服务');
insert into public.products (
  id, tenant_id, mall_id, supplier_id, spu_code, name, subtitle,
  category_code, cover_url, status
) values
  ('product-rice', 'tenant-smart-wing', 'mall-demo', 'supplier-central',
   'SPU-RICE-001', '五常大米礼盒', '企业福利严选', 'food', null, 'active'),
  ('product-movie', 'tenant-smart-wing', 'mall-demo', 'supplier-local',
   'SPU-MOVIE-001', '全国通用电影券', '电子券即时发放', 'virtual-card', null, 'active');
insert into public.skus (
  id, tenant_id, mall_id, product_id, sku_code, specs_json, price_cents, market_price_cents
) values
  ('sku-rice-5kg', 'tenant-smart-wing', 'mall-demo', 'product-rice', 'SKU-RICE-5KG',
   '{"重量":"5kg"}'::jsonb, 8900, 10900),
  ('sku-movie-single', 'tenant-smart-wing', 'mall-demo', 'product-movie', 'SKU-MOVIE-SINGLE',
   '{"类型":"单人票"}'::jsonb, 4500, 6000);
insert into public.inventory (tenant_id, mall_id, sku_id, available_qty, reserved_qty) values
  ('tenant-smart-wing', 'mall-demo', 'sku-rice-5kg', 1000, 0),
  ('tenant-smart-wing', 'mall-demo', 'sku-movie-single', 10000, 0);
insert into public.welfare_accounts (
  id, tenant_id, enterprise_id, mall_id, user_id, account_type, balance_cents
) values
  ('account-demo-welfare', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo',
   'user-demo', 'welfare', 328000),
  ('account-demo-meal', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo',
   'user-demo', 'meal', 85050);
