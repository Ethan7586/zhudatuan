-- Hard cutover from the legacy aggregate to Inventory's StockItem and
-- Reservation model.  No compatibility view or dual write survives this file.

lock table public.inventory,public.orders,public.order_items,inventory.stock_items,
  inventory.reservations,inventory.movements in share row exclusive mode;

insert into public.permissions (id,code,name,category,risk_level,is_mvp)
values (
  'permission-inventory-cutover-manage-v1',
  'inventory.cutover.manage',
  '审核库存切换',
  '商品',
  'critical',
  true
)
on conflict (code) do update
set name=excluded.name,category=excluded.category,
    risk_level=excluded.risk_level,is_mvp=excluded.is_mvp;

insert into public.role_permissions (role_id,permission_id)
select role.id,permission.id
from public.roles role
cross join public.permissions permission
where role.is_owner and role.status='active'
  and permission.code='inventory.cutover.manage'
on conflict do nothing;

update public.permissions
set risk_level='critical'
where code='inventory.update';

create table inventory.cutover_reviews (
  id text primary key default inventory.new_id(),
  tenant_id text not null,
  mall_id text not null,
  stock_item_id text not null,
  action text not null check (action in ('auto_zero_reserved','release_orphaned')),
  legacy_available integer not null check (legacy_available>=0),
  legacy_reserved integer not null check (legacy_reserved>=0),
  confirmed_onhand integer not null check (confirmed_onhand>=0),
  before_version bigint not null check (before_version>=0),
  after_version bigint not null check (after_version=before_version+1),
  review_reference text not null check (char_length(trim(review_reference)) between 8 and 200),
  actor_membership_id text references public.memberships(id) on delete restrict,
  actor_member_id text references public.members(id) on delete restrict,
  request_id text not null,
  evidence_json jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence_json)='object'),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id,mall_id,stock_item_id)
    references inventory.stock_items(tenant_id,mall_id,id),
  unique (tenant_id,mall_id,stock_item_id)
);
alter table inventory.cutover_reviews enable row level security;
revoke all on table inventory.cutover_reviews from public,anon,authenticated,service_role;
create trigger inventory_cutover_reviews_immutable
before update or delete on inventory.cutover_reviews for each row
execute function public.reject_immutable_change();

create or replace function inventory.available_stock(
  p_tenant_id text,p_mall_id text,p_sku_id text
) returns integer
language sql stable security definer
set search_path=inventory,public,pg_temp as $$
  select coalesce(sum(greatest(
    stock.onhand-stock.safety-coalesce((
      select sum(reservation.quantity)
      from inventory.reservations reservation
      where reservation.stock_item_id=stock.id and reservation.state='active'
    ),0),0
  )),0)::integer
  from inventory.stock_items stock
  where stock.tenant_id=p_tenant_id and stock.mall_id=p_mall_id
    and stock.sku_id=p_sku_id and stock.cutover_status='ready';
$$;

create or replace function inventory.stock_is_ready(
  p_tenant_id text,p_mall_id text,p_sku_id text
) returns boolean
language sql stable security definer
set search_path=inventory,public,pg_temp as $$
  select exists(
    select 1 from inventory.stock_items stock
    where stock.tenant_id=p_tenant_id and stock.mall_id=p_mall_id
      and stock.sku_id=p_sku_id and stock.cutover_status='ready'
  ) and not exists(
    select 1 from inventory.stock_items stock
    where stock.tenant_id=p_tenant_id and stock.mall_id=p_mall_id
      and stock.sku_id=p_sku_id and stock.cutover_status<>'ready'
  );
$$;

create or replace function inventory.apply_supplier_stock_snapshot(
  p_tenant_id text,p_mall_id text,p_sku_id text,p_observed_onhand integer,
  p_source_kind text,p_source_reference text,p_observed_at timestamptz
) returns text
language plpgsql security definer
set search_path=inventory,public,pg_temp as $$
declare
  stock_row inventory.stock_items%rowtype;
  result_status text;
begin
  if p_observed_onhand is null or p_observed_onhand<0
     or char_length(trim(coalesce(p_source_kind,''))) not between 1 and 80
     or char_length(trim(coalesce(p_source_reference,''))) not between 1 and 200
     or p_observed_at is null then
    raise exception 'SUPPLIER_STOCK_SNAPSHOT_INVALID';
  end if;

  select * into stock_row from inventory.stock_items stock
  where stock.tenant_id=p_tenant_id and stock.mall_id=p_mall_id
    and stock.sku_id=p_sku_id and stock.location_id='default'
  for update;
  if not found then
    insert into inventory.stock_items(
      tenant_id,mall_id,sku_id,location_id,onhand,safety,cutover_status
    ) values (p_tenant_id,p_mall_id,p_sku_id,'default',p_observed_onhand,0,'ready')
    returning * into stock_row;
    result_status:='applied';
  else
    -- Provider snapshots have no signed cursor proving that they include local
    -- sale/restock movements.  Any existing StockItem therefore requires a
    -- separate reconciliation command; this batch must remain all-or-nothing.
    raise exception 'SUPPLIER_STOCK_RECONCILIATION_REQUIRED';
  end if;

  insert into inventory.observations(
    tenant_id,mall_id,stock_item_id,sku_id,location_id,observation_kind,
    source_kind,source_reference,observed_onhand,disposition,payload_json,observed_at
  ) values (
    p_tenant_id,p_mall_id,stock_row.id,p_sku_id,'default','stock_snapshot',
    trim(p_source_kind),trim(p_source_reference),p_observed_onhand,
    'accepted',
    jsonb_build_object('cutoverStatus',stock_row.cutover_status),p_observed_at
  );
  return result_status;
end;
$$;

revoke all on function inventory.available_stock(text,text,text)
from public,anon,authenticated,service_role;
revoke all on function inventory.stock_is_ready(text,text,text)
from public,anon,authenticated,service_role;
revoke all on function inventory.apply_supplier_stock_snapshot(text,text,text,integer,text,text,timestamptz)
from public,anon,authenticated,service_role;

-- 123000 may already have been installed while legacy writers were still
-- active.  Reconcile a final locked snapshot before any legacy relation is
-- removed, and never silently discard rows created during that interval.
insert into inventory.stock_items(
  tenant_id,mall_id,sku_id,location_id,onhand,safety,version,cutover_status
)
select legacy.tenant_id,legacy.mall_id,legacy.sku_id,'default',
  legacy.available_qty,0,greatest(legacy.version,0),'manual_review'
from public.inventory legacy
on conflict(tenant_id,mall_id,sku_id,location_id) do nothing;

insert into inventory.cutover_records(
  tenant_id,mall_id,stock_item_id,source_relation,legacy_available,
  legacy_reserved,status,reason
)
select stock.tenant_id,stock.mall_id,stock.id,
  'public.inventory@20260820133000',legacy.available_qty,legacy.reserved_qty,
  'manual_review',case when legacy.reserved_qty>0
    then 'reservation_ownership_missing' else 'final_legacy_snapshot' end
from public.inventory legacy
join inventory.stock_items stock on stock.tenant_id=legacy.tenant_id
  and stock.mall_id=legacy.mall_id and stock.sku_id=legacy.sku_id
  and stock.location_id='default' and stock.cutover_status='manual_review'
on conflict(tenant_id,mall_id,stock_item_id,source_relation) do nothing;

do $$
begin
  if exists(
    select 1 from public.inventory legacy
    join inventory.stock_items stock on stock.tenant_id=legacy.tenant_id
      and stock.mall_id=legacy.mall_id and stock.sku_id=legacy.sku_id
      and stock.location_id='default' and stock.cutover_status='ready'
    where legacy.updated_at>stock.updated_at
  ) then raise exception 'INVENTORY_LEGACY_SNAPSHOT_NEWER_THAN_CANONICAL'; end if;
end;
$$;

with eligible as (
  select stock.id,stock.tenant_id,stock.mall_id,stock.sku_id,stock.version,
    legacy.available_qty,legacy.reserved_qty
  from inventory.stock_items stock
  join public.inventory legacy on legacy.tenant_id=stock.tenant_id
    and legacy.mall_id=stock.mall_id and legacy.sku_id=stock.sku_id
  where stock.location_id='default' and stock.cutover_status='manual_review'
    and legacy.reserved_qty=0
    and not exists(select 1 from inventory.reservations reservation where reservation.stock_item_id=stock.id)
    and not exists(select 1 from inventory.movements movement where movement.stock_item_id=stock.id)
    and not exists(
      select 1 from public.order_items item
      join public.orders orders on orders.id=item.order_id
      where item.sku_id=stock.sku_id and orders.tenant_id=stock.tenant_id
        and orders.mall_id=stock.mall_id
        and orders.status in('pending_payment','paid','processing','shipped','refund_pending')
    )
), activated as (
  update inventory.stock_items stock
  set cutover_status='ready',onhand=eligible.available_qty,version=stock.version+1
  from eligible where stock.id=eligible.id
  returning stock.id,stock.tenant_id,stock.mall_id,stock.onhand,
    stock.version,eligible.available_qty,eligible.reserved_qty,eligible.version as before_version
)
insert into inventory.cutover_reviews(
  tenant_id,mall_id,stock_item_id,action,legacy_available,legacy_reserved,
  confirmed_onhand,before_version,after_version,review_reference,request_id
)
select activated.tenant_id,activated.mall_id,activated.id,'auto_zero_reserved',
  activated.available_qty,activated.reserved_qty,activated.onhand,
  activated.before_version,activated.version,'auto-zero-reserved','inventory-cutover-auto'
from activated;

insert into public.audit_logs(
  id,tenant_id,mall_id,actor_type,action,resource_type,resource_id,
  request_id,after_json,created_at
)
select gen_random_uuid()::text,review.tenant_id,review.mall_id,'system',
  'inventory.cutover.auto_ready','inventory_stock',review.stock_item_id,
  review.request_id,jsonb_build_object(
    'legacyAvailable',review.legacy_available,'legacyReserved',review.legacy_reserved,
    'confirmedOnhand',review.confirmed_onhand,'afterVersion',review.after_version
  ),review.created_at
from inventory.cutover_reviews review
where review.action='auto_zero_reserved';

-- The legacy table is removed in this migration.  Do not cross that boundary
-- while any quantity or open order still needs attribution: a post-deploy
-- review cannot reconstruct history that the destructive cutover discarded.
do $$
begin
  if exists(
    select 1 from inventory.stock_items stock
    where stock.cutover_status='manual_review'
  ) then
    raise exception 'INVENTORY_CUTOVER_RECONCILIATION_REQUIRED';
  end if;
end;
$$;

create or replace function inventory.lock_cutover_operator(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,p_evidence jsonb
) returns boolean
language plpgsql volatile security definer
set search_path=inventory,public,pg_temp as $$
declare actor_enterprise_id text; actor_mall_id text;
begin
  select membership.enterprise_id,membership.mall_id
  into actor_enterprise_id,actor_mall_id
  from public.memberships membership
  where membership.id=p_actor_membership_id;
  return coalesce(
    public.api_lock_membership_actor(
      p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,
      actor_enterprise_id,actor_mall_id
    )
    and public.api_membership_has_permission(
      p_actor_membership_id,'inventory.cutover.manage'
    )
    and public.api_authorization_evidence_matches(
      p_evidence,p_actor_membership_id,'inventory.cutover.manage',true
    )
    and exists(
      select 1 from public.membership_scopes scope
      join public.org_units platform on platform.id=scope.resource_id
      where scope.membership_id=p_actor_membership_id
        and scope.scope_kind='platform' and platform.kind='platform'
        and platform.status='active'
    ),false
  );
end;
$$;
revoke all on function inventory.lock_cutover_operator(text,text,text,jsonb)
from public,anon,authenticated,service_role;

create or replace function public.api_inventory_cutover_status_authorized(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,
  p_evidence jsonb,p_after_stock_item_id text default null,p_limit integer default 50
) returns jsonb
language plpgsql volatile security definer
set search_path=public,inventory,pg_temp as $$
declare
  manual_count bigint; ready_count bigint; items_json jsonb; next_cursor text;
begin
  if p_limit not between 1 and 100
     or char_length(coalesce(p_after_stock_item_id,''))>200 then
    raise exception 'INVALID_INVENTORY_CUTOVER_QUERY';
  end if;
  if not inventory.lock_cutover_operator(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_evidence
  ) then raise exception 'INVENTORY_CUTOVER_NOT_AUTHORIZED'; end if;

  select count(*) filter(where stock.cutover_status='manual_review'),
         count(*) filter(where stock.cutover_status='ready')
  into manual_count,ready_count
  from inventory.stock_items stock where stock.tenant_id=p_tenant_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'stockItemId',page.id,'mallId',page.mall_id,'skuId',page.sku_id,
    'locationId',page.location_id,'onhand',page.onhand,'safety',page.safety,
    'version',page.version,'cutoverStatus',page.cutover_status,
    'legacyAvailable',record.legacy_available,
    'legacyReserved',record.legacy_reserved,'reason',record.reason,
    'availableStock',inventory.available_stock(
      page.tenant_id,page.mall_id,page.sku_id
    )
  ) order by page.id),'[]'::jsonb)
  into items_json
  from (
    select stock.* from inventory.stock_items stock
    where stock.tenant_id=p_tenant_id and stock.cutover_status='manual_review'
      and (p_after_stock_item_id is null or stock.id>p_after_stock_item_id)
    order by stock.id limit p_limit
  ) page
  left join lateral(
    select candidate.* from inventory.cutover_records candidate
    where candidate.stock_item_id=page.id
    order by candidate.captured_at desc,candidate.id desc limit 1
  ) record on true;
  if jsonb_array_length(items_json)=p_limit then
    next_cursor:=items_json->(jsonb_array_length(items_json)-1)->>'stockItemId';
    if not exists(
      select 1 from inventory.stock_items stock
      where stock.tenant_id=p_tenant_id and stock.cutover_status='manual_review'
        and stock.id>next_cursor
    ) then next_cursor:=null; end if;
  end if;
  return jsonb_build_object(
    'deploymentReady',manual_count=0,'manualReviewCount',manual_count,
    'readyCount',ready_count,'items',items_json,'nextCursor',next_cursor
  );
end;
$$;

create or replace function public.api_review_inventory_cutover_authorized(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,
  p_stock_item_id text,p_expected_version bigint,
  p_confirmed_onhand integer,p_review_reference text,p_idempotency_key text,
  p_request_hash text,p_request_id text,p_user_agent text,p_evidence jsonb
) returns jsonb
language plpgsql volatile security definer
set search_path=public,inventory,pg_temp as $$
declare
  existing_key public.idempotency_keys%rowtype;
  stock_row inventory.stock_items%rowtype;
  cutover_record inventory.cutover_records%rowtype;
  actor_member_id text;
  target_enterprise_id text;
  response_json jsonb;
begin
  if char_length(trim(coalesce(p_stock_item_id,''))) not between 1 and 200
     or p_expected_version is null or p_expected_version<0
     or p_confirmed_onhand is null or p_confirmed_onhand<0
     or char_length(trim(coalesce(p_review_reference,''))) not between 8 and 200
     or char_length(trim(coalesce(p_idempotency_key,''))) not between 8 and 160
     or p_request_hash !~ '^[A-Za-z0-9+/]{43}=$' then
    raise exception 'INVALID_INVENTORY_CUTOVER_REVIEW';
  end if;
  if not inventory.lock_cutover_operator(
    p_actor_membership_id,p_actor_user_id,p_tenant_id,p_evidence
  ) then
    raise exception 'INVENTORY_CUTOVER_NOT_AUTHORIZED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id||':'||p_stock_item_id||':inventory-cutover:'||trim(p_idempotency_key),0
  ));
  select * into stock_row from inventory.stock_items stock
  where stock.id=p_stock_item_id and stock.tenant_id=p_tenant_id
  for update;
  if not found then raise exception 'INVENTORY_STOCK_NOT_FOUND'; end if;
  select mall.enterprise_id into strict target_enterprise_id
  from public.malls mall
  where mall.id=stock_row.mall_id and mall.tenant_id=p_tenant_id;
  if not public.api_membership_scope_allows(
    p_actor_membership_id,p_tenant_id,target_enterprise_id,stock_row.mall_id
  ) then raise exception 'INVENTORY_CUTOVER_NOT_AUTHORIZED'; end if;
  select * into existing_key from public.idempotency_keys key
  where key.tenant_id=p_tenant_id and key.mall_id=stock_row.mall_id
    and key.scope='inventory:cutover'
    and key.idempotency_key=trim(p_idempotency_key);
  if found then
    if existing_key.request_hash is distinct from p_request_hash
       or existing_key.resource_id is distinct from p_stock_item_id
       or (existing_key.response_json->>'confirmedOnhand')::integer is distinct from p_confirmed_onhand
       or (existing_key.response_json->>'beforeVersion')::bigint is distinct from p_expected_version then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return existing_key.response_json;
  end if;
  if stock_row.cutover_status<>'manual_review'
     or stock_row.version<>p_expected_version then
    raise exception 'INVENTORY_CUTOVER_VERSION_CONFLICT';
  end if;
  if p_confirmed_onhand<stock_row.safety then
    raise exception 'INVALID_INVENTORY_CUTOVER_REVIEW';
  end if;
  if exists(select 1 from inventory.reservations reservation where reservation.stock_item_id=stock_row.id)
     or exists(select 1 from inventory.movements movement where movement.stock_item_id=stock_row.id) then
    raise exception 'INVENTORY_CUTOVER_ACTIVITY_CONFLICT';
  end if;
  if exists(
    select 1 from public.order_items item
    join public.orders orders on orders.id=item.order_id
    where item.sku_id=stock_row.sku_id and orders.tenant_id=p_tenant_id
      and orders.mall_id=stock_row.mall_id
      and orders.status in('pending_payment','paid','processing','shipped','refund_pending')
  ) then
    raise exception 'INVENTORY_OPEN_ORDER_RECONCILIATION_REQUIRED';
  end if;
  select * into strict cutover_record from inventory.cutover_records record
  where record.stock_item_id=stock_row.id order by record.captured_at desc limit 1;
  select membership.member_id into strict actor_member_id
  from public.memberships membership where membership.id=p_actor_membership_id;

  update inventory.stock_items stock
  set onhand=p_confirmed_onhand,cutover_status='ready',version=stock.version+1
  where stock.id=stock_row.id returning * into stock_row;
  insert into inventory.cutover_reviews(
    tenant_id,mall_id,stock_item_id,action,legacy_available,legacy_reserved,
    confirmed_onhand,before_version,after_version,review_reference,
    actor_membership_id,actor_member_id,request_id,evidence_json
  ) values (
    p_tenant_id,stock_row.mall_id,stock_row.id,'release_orphaned',
    cutover_record.legacy_available,cutover_record.legacy_reserved,p_confirmed_onhand,
    p_expected_version,stock_row.version,trim(p_review_reference),
    p_actor_membership_id,actor_member_id,p_request_id,jsonb_build_object(
      'permission','inventory.cutover.manage','authzVersion',p_evidence->'authzVersion',
      'stepUpAt',p_evidence->'stepUpAt'
    )
  );
  response_json:=jsonb_build_object(
    'stockItemId',stock_row.id,'skuId',stock_row.sku_id,'status','ready',
    'confirmedOnhand',p_confirmed_onhand,'beforeVersion',p_expected_version,
    'afterVersion',stock_row.version,'requestId',p_request_id
  );
  insert into public.idempotency_keys(
    tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,response_json,
    created_at,expires_at
  ) values (
    p_tenant_id,stock_row.mall_id,'inventory:cutover',trim(p_idempotency_key),p_request_hash,
    stock_row.id,response_json,clock_timestamp(),clock_timestamp()+interval '24 hours'
  );
  insert into public.audit_logs(
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,user_agent,before_json,after_json,
    membership_id,granted_via,created_at
  ) values (
    gen_random_uuid()::text,p_tenant_id,target_enterprise_id,stock_row.mall_id,p_actor_user_id,
    'admin','inventory.cutover.release_orphaned','inventory_stock',stock_row.id,
    p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object(
      'legacyAvailable',cutover_record.legacy_available,
      'legacyReserved',cutover_record.legacy_reserved,'version',p_expected_version
    ),response_json,p_actor_membership_id,p_evidence,clock_timestamp()
  );
  return response_json;
end;
$$;

create or replace function public.api_inventory_readiness()
returns jsonb language sql stable security definer
set search_path=public,inventory,pg_temp as $$
  select jsonb_build_object(
    'ready',count(*) filter(where stock.cutover_status='manual_review')=0,
    'manualReviewCount',count(*) filter(where stock.cutover_status='manual_review'),
    'readyCount',count(*) filter(where stock.cutover_status='ready')
  ) from inventory.stock_items stock;
$$;

revoke all on function public.api_inventory_cutover_status_authorized(text,text,text,jsonb,text,integer)
from public,anon,authenticated;
revoke all on function public.api_review_inventory_cutover_authorized(text,text,text,text,bigint,integer,text,text,text,text,text,jsonb)
from public,anon,authenticated;
revoke all on function public.api_inventory_readiness()
from public,anon,authenticated;
grant execute on function public.api_inventory_cutover_status_authorized(text,text,text,jsonb,text,integer)
to service_role;
grant execute on function public.api_review_inventory_cutover_authorized(text,text,text,text,bigint,integer,text,text,text,text,text,jsonb)
to service_role;
grant execute on function public.api_inventory_readiness() to service_role;

create or replace function public.api_catalog(
  p_mall_slug text,p_category text default null,p_limit integer default 24,
  p_offset integer default 0
) returns table(
  id text,sku_id text,name text,name_en text,name_zh text,subtitle text,
  subtitle_en text,subtitle_zh text,category_code text,taxonomy_l1 text,
  taxonomy_l2 text,taxonomy_l3 text,classification_status text,cover_url text,
  price_cents bigint,market_price_cents bigint,available_stock integer,
  supplier_name text,is_test boolean
) language sql stable security definer set search_path=public,inventory,pg_temp as $$
  select product.id,sku.id,coalesce(product.name_zh,product.name),product.name_en,
    product.name_zh,coalesce(product.subtitle_zh,product.subtitle),product.subtitle_en,
    product.subtitle_zh,product.taxonomy_l1,product.taxonomy_l1,product.taxonomy_l2,
    product.taxonomy_l3,product.classification_status,product.cover_url,
    sku.price_cents,sku.market_price_cents,
    inventory.available_stock(product.tenant_id,product.mall_id,sku.id),
    supplier.name,product.is_test
  from public.products product
  join public.malls mall on mall.id=product.mall_id
  join public.skus sku on sku.product_id=product.id and sku.mall_id=product.mall_id
  join public.suppliers supplier on supplier.id=product.supplier_id
  where mall.public_slug=p_mall_slug
    and (p_category is null or product.taxonomy_l1=p_category)
    and public.is_valid_catalog_taxonomy_path(
      product.taxonomy_l1,product.taxonomy_l2,product.taxonomy_l3
    ) and product.classification_confidence>=0.8
    and product.status='active' and sku.status='active' and mall.status='active'
    and inventory.stock_is_ready(product.tenant_id,product.mall_id,sku.id)
  order by product.created_at desc,sku.id
  limit least(greatest(p_limit,1),100) offset greatest(p_offset,0);
$$;

create or replace function public.api_public_catalog_window(
  p_mall_slug text,p_limit integer default 200,p_offset integer default 0
) returns table(
  id text,sku_id text,name text,name_en text,name_zh text,subtitle text,
  subtitle_en text,subtitle_zh text,category_code text,taxonomy_l1 text,
  taxonomy_l2 text,taxonomy_l3 text,classification_status text,cover_url text,
  price_cents bigint,market_price_cents bigint,available_stock integer,
  supplier_name text,is_test boolean
) language sql stable security definer set search_path=public,inventory,pg_temp as $$
  with eligible as (
    select product.id,sku.id as sku_id,coalesce(product.name_zh,product.name) as name,
      product.name_en,product.name_zh,
      coalesce(product.subtitle_zh,product.subtitle) as subtitle,
      product.subtitle_en,product.subtitle_zh,product.taxonomy_l1 as category_code,
      product.taxonomy_l1,product.taxonomy_l2,product.taxonomy_l3,
      product.classification_status,product.cover_url,sku.price_cents,
      sku.market_price_cents,
      inventory.available_stock(product.tenant_id,product.mall_id,sku.id) as available_stock,
      supplier.name as supplier_name,product.is_test,product.created_at,
      row_number() over(
        partition by product.taxonomy_l1 order by product.created_at desc,sku.id
      ) as category_rank,
      case product.taxonomy_l1 when 'food' then 1 when 'appliance' then 2
        when 'digital' then 3 when 'home' then 4 when 'personal' then 5
        when 'welfare' then 6 else 99 end as category_order
    from public.products product
    join public.malls mall on mall.id=product.mall_id
    join public.skus sku on sku.product_id=product.id and sku.mall_id=product.mall_id
    join public.suppliers supplier on supplier.id=product.supplier_id
    where mall.public_slug=p_mall_slug
      and product.taxonomy_l1 in ('food','appliance','digital','home','personal','welfare')
      and public.is_valid_catalog_taxonomy_path(
        product.taxonomy_l1,product.taxonomy_l2,product.taxonomy_l3
      ) and product.classification_confidence>=0.8
      and product.status='active' and sku.status='active' and mall.status='active'
      and inventory.stock_is_ready(product.tenant_id,product.mall_id,sku.id)
  )
  select eligible.id,eligible.sku_id,eligible.name,eligible.name_en,eligible.name_zh,
    eligible.subtitle,eligible.subtitle_en,eligible.subtitle_zh,eligible.category_code,
    eligible.taxonomy_l1,eligible.taxonomy_l2,eligible.taxonomy_l3,
    eligible.classification_status,eligible.cover_url,eligible.price_cents,
    eligible.market_price_cents,eligible.available_stock,eligible.supplier_name,
    eligible.is_test
  from eligible
  order by eligible.category_rank,eligible.category_order,
    eligible.created_at desc,eligible.sku_id
  limit least(greatest(p_limit,1),100) offset greatest(p_offset,0);
$$;

create or replace function public.api_catalog_qualified(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_user_id text,
  p_membership_id text,p_category text default null,p_limit integer default 24,
  p_offset integer default 0
) returns table(
  id text,sku_id text,name text,name_en text,name_zh text,subtitle text,
  subtitle_en text,subtitle_zh text,category_code text,taxonomy_l1 text,
  taxonomy_l2 text,taxonomy_l3 text,classification_status text,cover_url text,
  price_cents bigint,market_price_cents bigint,available_stock integer,
  supplier_name text,is_test boolean,purchasable boolean,qualification jsonb
) language sql stable security definer set search_path=public,inventory,pg_temp as $$
  select product.id,sku.id,coalesce(product.name_zh,product.name),product.name_en,
    product.name_zh,coalesce(product.subtitle_zh,product.subtitle),product.subtitle_en,
    product.subtitle_zh,product.taxonomy_l1,product.taxonomy_l1,product.taxonomy_l2,
    product.taxonomy_l3,product.classification_status,product.cover_url,
    sku.price_cents,sku.market_price_cents,
    inventory.available_stock(product.tenant_id,product.mall_id,sku.id),
    supplier.name,product.is_test,
    coalesce((qualification.result->>'purchasable')::boolean,false)
      and inventory.available_stock(product.tenant_id,product.mall_id,sku.id)>0,
    qualification.result
  from public.products product
  join public.skus sku on sku.product_id=product.id and sku.mall_id=product.mall_id
  join public.suppliers supplier on supplier.id=product.supplier_id
  cross join lateral public.api_employee_sku_qualification(
    p_tenant_id,p_enterprise_id,p_mall_id,p_user_id,p_membership_id,sku.id,1,null,null
  ) qualification(result)
  where product.tenant_id=p_tenant_id and product.mall_id=p_mall_id
    and (p_category is null or product.taxonomy_l1=p_category)
    and public.is_valid_catalog_taxonomy_path(
      product.taxonomy_l1,product.taxonomy_l2,product.taxonomy_l3
    ) and product.classification_confidence>=0.8
    and product.status='active' and sku.status='active'
    and inventory.stock_is_ready(product.tenant_id,product.mall_id,sku.id)
    and coalesce((qualification.result->>'visible')::boolean,false)
  order by product.created_at desc,sku.id
  limit least(greatest(p_limit,1),100) offset greatest(p_offset,0);
$$;

create or replace function public.api_cart_snapshot_qualified(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_user_id text,
  p_membership_id text
) returns jsonb language sql stable security definer
set search_path=public,inventory,pg_temp as $$
  select coalesce(jsonb_agg(row_value.payload order by row_value.updated_at desc),'[]'::jsonb)
  from (
    select item.updated_at,jsonb_build_object(
      'id',item.id,'skuId',item.sku_id,'productId',product.id,
      'quantity',item.quantity,'selected',item.selected,'updatedAt',item.updated_at,
      'purchasable',coalesce((decision.result->>'purchasable')::boolean,false)
        and inventory.stock_is_ready(p_tenant_id,p_mall_id,item.sku_id)
        and inventory.available_stock(p_tenant_id,p_mall_id,item.sku_id)>=item.quantity,
      'qualification',decision.result,'name',product.name,'subtitle',product.subtitle,
      'categoryCode',product.category_code,'taxonomy',jsonb_build_object(
        'l1',product.taxonomy_l1,'l2',product.taxonomy_l2,'l3',product.taxonomy_l3
      ),'coverUrl',product.cover_url,'specs',sku.specs_json,
      'priceCents',sku.price_cents,'marketPriceCents',sku.market_price_cents,
      'availableStock',inventory.available_stock(p_tenant_id,p_mall_id,item.sku_id),
      'supplierId',supplier.id,'supplierName',supplier.name,'isTest',product.is_test
    ) as payload
    from public.carts cart
    join public.cart_items item on item.cart_id=cart.id
      and item.tenant_id=p_tenant_id and item.mall_id=p_mall_id
    join public.skus sku on sku.id=item.sku_id
      and sku.tenant_id=p_tenant_id and sku.mall_id=p_mall_id
    join public.products product on product.id=sku.product_id
      and product.tenant_id=p_tenant_id and product.mall_id=p_mall_id
    join public.suppliers supplier on supplier.id=product.supplier_id
    cross join lateral public.api_employee_sku_qualification(
      p_tenant_id,p_enterprise_id,p_mall_id,p_user_id,p_membership_id,
      item.sku_id,item.quantity,null,null,null
    ) decision(result)
    where cart.tenant_id=p_tenant_id and cart.mall_id=p_mall_id
      and cart.user_id=p_user_id
  ) row_value;
$$;

revoke all on function public.api_admin_catalog(text,text,integer)
from public,anon,authenticated,service_role;
drop function public.api_admin_catalog(text,text,integer);

create function public.api_admin_catalog(
  p_actor_membership_id text,p_actor_user_id text,p_tenant_id text,
  p_enterprise_id text,p_mall_id text,p_evidence jsonb,p_limit integer default 100
) returns jsonb language plpgsql volatile security definer
set search_path=public,inventory,pg_temp as $$
declare result_json jsonb;
begin
  if p_limit not between 1 and 100 then raise exception 'INVALID_ADMIN_CATALOG_QUERY'; end if;
  if not public.api_lock_membership_actor(
       p_actor_membership_id,p_actor_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_actor_membership_id,'catalog.read')
     or not public.api_authorization_evidence_matches(
       p_evidence,p_actor_membership_id,'catalog.read',false
     ) then raise exception 'ADMIN_CATALOG_NOT_AUTHORIZED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',product.id,'skuId',sku.id,'name',coalesce(product.name_zh,product.name),
    'nameZh',product.name_zh,'supplierName',supplier.name,
    'categoryCode',product.category_code,'coverUrl',product.cover_url,
    'priceCents',sku.price_cents,'marketPriceCents',sku.market_price_cents,
    'availableStock',inventory.available_stock(product.tenant_id,product.mall_id,sku.id),
    'inventoryStatus',case when inventory.stock_is_ready(
      product.tenant_id,product.mall_id,sku.id
    ) then 'ready' else 'manual_review' end,
    'status',product.status,'classificationStatus',product.classification_status
  ) order by product.updated_at desc,product.id),'[]'::jsonb) into result_json
  from (
    select * from public.products candidate
    where candidate.tenant_id=p_tenant_id and candidate.mall_id=p_mall_id
    order by candidate.updated_at desc,candidate.id limit p_limit
  ) product
  join public.suppliers supplier on supplier.id=product.supplier_id
  left join lateral(
    select candidate.id,candidate.price_cents,candidate.market_price_cents
    from public.skus candidate where candidate.product_id=product.id
      and candidate.tenant_id=p_tenant_id and candidate.mall_id=p_mall_id
    order by candidate.id limit 1
  ) sku on true;
  return result_json;
end;
$$;

revoke all on function public.api_catalog(text,text,integer,integer)
from public,anon,authenticated;
revoke all on function public.api_public_catalog_window(text,integer,integer)
from public,anon,authenticated;
revoke all on function public.api_catalog_qualified(text,text,text,text,text,text,integer,integer)
from public,anon,authenticated;
revoke all on function public.api_cart_snapshot_qualified(text,text,text,text,text)
from public,anon,authenticated;
revoke all on function public.api_admin_catalog(text,text,text,text,text,jsonb,integer)
from public,anon,authenticated;
grant execute on function public.api_catalog(text,text,integer,integer) to service_role;
grant execute on function public.api_public_catalog_window(text,integer,integer) to service_role;
grant execute on function public.api_catalog_qualified(text,text,text,text,text,text,integer,integer)
to service_role;
grant execute on function public.api_cart_snapshot_qualified(text,text,text,text,text)
to service_role;
grant execute on function public.api_admin_catalog(text,text,text,text,text,jsonb,integer)
to service_role;

create or replace function public.api_upsert_supplier_catalog(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_operator_user_id text,
  p_source text,p_supplier_name text,p_items jsonb,p_idempotency_key text,
  p_request_hash text,p_request_id text,p_user_agent text,p_membership_id text,
  p_granted_via jsonb
) returns jsonb language plpgsql volatile security definer
set search_path=public,inventory,pg_temp as $$
declare
  now_at timestamptz:=clock_timestamp();
  existing_key public.idempotency_keys%rowtype;
  supplier_id text;item_json jsonb;product_id text;sku_id text;item_status text;
  response_json jsonb;written_count integer:=0;blocked_count integer:=0;
  stock_result text;
begin
  if p_source !~ '^[a-z][a-z0-9_-]{1,39}$'
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 100
     or char_length(trim(coalesce(p_idempotency_key,''))) not between 8 and 120
     or p_request_hash !~ '^[A-Za-z0-9+/]{43}=$' then
    raise exception 'INVALID_CATALOG_IMPORT_INPUT';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_items) item
    where jsonb_typeof(item) is distinct from 'object'
      or char_length(trim(coalesce(item->>'externalSpuId',''))) not between 1 and 200
      or char_length(trim(coalesce(item->>'externalSkuId',''))) not between 1 and 200
      or char_length(trim(coalesce(item->>'name',''))) not between 1 and 500
      or item->>'name' ~ '[[:cntrl:]]'
      or coalesce(jsonb_typeof(item->'detail'),'object')<>'object'
      or coalesce(jsonb_typeof(item->'specs'),'object')<>'object'
      or jsonb_typeof(item->'priceCents') is distinct from 'number'
      or item->>'priceCents' !~ '^(0|[1-9][0-9]{0,15})$'
      or jsonb_typeof(item->'availableStock') is distinct from 'number'
      or item->>'availableStock' !~ '^(0|[1-9][0-9]{0,9})$'
      or (item->>'availableStock')::bigint>2147483647
      or (item ? 'marketPriceCents' and item->'marketPriceCents'<>'null'::jsonb and (
        jsonb_typeof(item->'marketPriceCents') is distinct from 'number'
        or item->>'marketPriceCents' !~ '^(0|[1-9][0-9]{0,15})$'
        or (item->>'marketPriceCents')::bigint<(item->>'priceCents')::bigint
      )) or coalesce(item->>'status','active') not in ('active','inactive')
  ) then raise exception 'INVALID_CATALOG_IMPORT_INPUT'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_items) item
    group by item->>'externalSkuId' having count(*)>1
  ) then raise exception 'DUPLICATE_SOURCE_SKU_IN_BATCH'; end if;

  if not public.api_lock_membership_actor(
       p_membership_id,p_operator_user_id,'admin',p_tenant_id,p_enterprise_id,p_mall_id
     ) or not public.api_membership_has_permission(p_membership_id,'product.publish')
     or not public.api_membership_has_permission(p_membership_id,'price.update')
     or not public.api_membership_has_permission(p_membership_id,'inventory.update')
     or not public.api_authorization_evidence_matches(
       p_granted_via,p_membership_id,'inventory.update',true
     ) then raise exception 'CATALOG_IMPORT_NOT_AUTHORIZED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id||':'||p_mall_id||':'||p_source||':supplier-stock',0
  ));
  select * into existing_key from public.idempotency_keys key
  where key.mall_id=p_mall_id and key.scope='catalog:upsert'
    and key.idempotency_key=trim(p_idempotency_key);
  if found then
    if existing_key.tenant_id is distinct from p_tenant_id
       or existing_key.request_hash is distinct from p_request_hash
       or existing_key.resource_id is distinct from 'catalog-source:'||p_source then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return existing_key.response_json;
  end if;
  select count(*) into blocked_count
  from jsonb_array_elements(p_items) item
    join inventory.stock_items stock on stock.tenant_id=p_tenant_id
      and stock.mall_id=p_mall_id and stock.location_id='default'
      and stock.sku_id='sku-source-'||md5(
        p_mall_id||':'||p_source||':'||(item->>'externalSkuId')
      );
  if blocked_count>0 then
    insert into inventory.sync_states(
      tenant_id,mall_id,source_kind,source_reference,location_id,state,
      observed_count,applied_count,failed_count,last_error,version,
      started_at,completed_at
    ) values (
      p_tenant_id,p_mall_id,'supplier',p_source,'default','failed',
      jsonb_array_length(p_items),0,jsonb_array_length(p_items),
      'SUPPLIER_STOCK_RECONCILIATION_REQUIRED',0,now_at,now_at
    ) on conflict(tenant_id,mall_id,source_kind,source_reference,location_id)
    do update set state='failed',observed_count=excluded.observed_count,
      applied_count=0,failed_count=excluded.failed_count,
      last_error=excluded.last_error,version=inventory.sync_states.version+1,
      started_at=excluded.started_at,completed_at=excluded.completed_at;

    update public.skus sku
    set status='inactive',updated_at=now_at
    where sku.tenant_id=p_tenant_id and sku.mall_id=p_mall_id
      and exists(
        select 1 from jsonb_array_elements(p_items) item
        where sku.id='sku-source-'||md5(
          p_mall_id||':'||p_source||':'||(item->>'externalSkuId')
        )
      );
    insert into inventory.observations(
      tenant_id,mall_id,stock_item_id,sku_id,location_id,observation_kind,
      source_kind,source_reference,observed_onhand,disposition,payload_json,
      observed_at
    )
    select p_tenant_id,p_mall_id,stock.id,stock.sku_id,'default','stock_snapshot',
      p_source,p_source||':'||md5(
        trim(p_idempotency_key)||':'||(item->>'externalSkuId')
      ),(item->>'availableStock')::integer,'pending',jsonb_build_object(
        'reason','provider_cursor_required','cutoverStatus',stock.cutover_status
      ),now_at
    from jsonb_array_elements(p_items) item
    join inventory.stock_items stock on stock.tenant_id=p_tenant_id
      and stock.mall_id=p_mall_id and stock.location_id='default'
      and stock.sku_id='sku-source-'||md5(
        p_mall_id||':'||p_source||':'||(item->>'externalSkuId')
      );
    response_json:=jsonb_build_object(
      'source',p_source,'itemsWritten',0,'blockedStockItems',blocked_count,
      'status','blocked_reconciliation','requestId',p_request_id,'updatedAt',now_at
    );
    insert into public.idempotency_keys(
      tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,
      response_json,created_at,expires_at
    ) values (
      p_tenant_id,p_mall_id,'catalog:upsert',trim(p_idempotency_key),p_request_hash,
      'catalog-source:'||p_source,response_json,now_at,now_at+interval '100 years'
    );
    insert into public.audit_logs(
      id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
      resource_type,resource_id,request_id,user_agent,after_json,membership_id,
      granted_via,created_at
    ) values (
      gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,
      p_operator_user_id,'admin','catalog.source_sync_blocked','catalog_source',
      p_source,p_request_id,left(coalesce(p_user_agent,''),300),response_json||
      jsonb_build_object('requiredPermissions',jsonb_build_array(
        'product.publish','price.update','inventory.update'
      )),p_membership_id,p_granted_via,now_at
    );
    return response_json;
  end if;

  insert into inventory.sync_states(
    tenant_id,mall_id,source_kind,source_reference,location_id,state,
    observed_count,applied_count,failed_count,version,started_at,completed_at
  ) values (
    p_tenant_id,p_mall_id,'supplier',p_source,'default','running',
    jsonb_array_length(p_items),0,0,0,now_at,null
  ) on conflict(tenant_id,mall_id,source_kind,source_reference,location_id)
  do update set state='running',observed_count=excluded.observed_count,
    applied_count=0,failed_count=0,last_error=null,
    version=inventory.sync_states.version+1,started_at=excluded.started_at,
    completed_at=null;

  supplier_id:='supplier-source-'||md5(p_tenant_id||':'||p_source);
  insert into public.suppliers(id,tenant_id,code,name,settlement_mode,status)
  values (
    supplier_id,p_tenant_id,'source-'||p_source,
    coalesce(nullif(trim(p_supplier_name),''),p_source),'api','active'
  ) on conflict(id) do update set name=excluded.name,status='active';

  for item_json in
    select value from jsonb_array_elements(p_items)
    order by value->>'externalSkuId'
  loop
    product_id:='product-source-'||md5(
      p_mall_id||':'||p_source||':'||(item_json->>'externalSpuId')
    );
    sku_id:='sku-source-'||md5(
      p_mall_id||':'||p_source||':'||(item_json->>'externalSkuId')
    );
    item_status:=coalesce(item_json->>'status','active');
    insert into public.products(
      id,tenant_id,mall_id,supplier_id,spu_code,name,name_zh,subtitle,
      category_code,cover_url,detail_json,status,source_code,source_spu_id,
      classification_status,classification_confidence
    ) values (
      product_id,p_tenant_id,p_mall_id,supplier_id,
      p_source||':'||(item_json->>'externalSpuId'),left(trim(item_json->>'name'),500),
      nullif(left(trim(coalesce(item_json->>'nameZh','')),500),''),
      nullif(left(trim(coalesce(item_json->>'subtitle','')),500),''),'welfare',
      nullif(item_json->>'coverUrl',''),jsonb_strip_nulls(jsonb_build_object(
        'source',p_source,'sourceCategory',item_json->>'sourceCategory',
        'externalSpuId',item_json->>'externalSpuId'
      ))||coalesce(item_json->'detail','{}'::jsonb),item_status,p_source,
      item_json->>'externalSpuId','pending',0
    ) on conflict(id) do update set supplier_id=excluded.supplier_id,
      name=excluded.name,name_zh=coalesce(public.products.name_zh,excluded.name_zh),
      subtitle=excluded.subtitle,cover_url=excluded.cover_url,
      detail_json=excluded.detail_json,status=excluded.status,updated_at=now_at;

    insert into public.skus(
      id,tenant_id,mall_id,product_id,sku_code,specs_json,price_cents,
      market_price_cents,status,source_code,source_sku_id
    ) values (
      sku_id,p_tenant_id,p_mall_id,product_id,
      p_source||':'||(item_json->>'externalSkuId'),
      coalesce(item_json->'specs','{}'::jsonb),(item_json->>'priceCents')::bigint,
      case when item_json->'marketPriceCents' is null
        or item_json->'marketPriceCents'='null'::jsonb then null
        else (item_json->>'marketPriceCents')::bigint end,
      item_status,p_source,item_json->>'externalSkuId'
    ) on conflict(id) do update set product_id=excluded.product_id,
      specs_json=excluded.specs_json,price_cents=excluded.price_cents,
      market_price_cents=excluded.market_price_cents,status=excluded.status,
      updated_at=now_at;

    stock_result:=inventory.apply_supplier_stock_snapshot(
      p_tenant_id,p_mall_id,sku_id,(item_json->>'availableStock')::integer,
      p_source,p_source||':'||md5(
        trim(p_idempotency_key)||':'||(item_json->>'externalSkuId')
      ),now_at
    );
    if stock_result<>'applied' then
      raise exception 'SUPPLIER_STOCK_RECONCILIATION_REQUIRED';
    end if;
    written_count:=written_count+1;
  end loop;

  update inventory.sync_states state
  set state='completed',applied_count=written_count,failed_count=0,last_error=null,
    version=state.version+1,completed_at=clock_timestamp()
  where state.tenant_id=p_tenant_id and state.mall_id=p_mall_id
    and state.source_kind='supplier' and state.source_reference=p_source
    and state.location_id='default';
  response_json:=jsonb_build_object(
    'source',p_source,'supplierId',supplier_id,'itemsWritten',written_count,
    'status','completed',
    'requestId',p_request_id,'updatedAt',now_at
  );
  insert into public.idempotency_keys(
    tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,response_json,
    created_at,expires_at
  ) values (
    p_tenant_id,p_mall_id,'catalog:upsert',trim(p_idempotency_key),p_request_hash,
    'catalog-source:'||p_source,response_json,now_at,now_at+interval '100 years'
  );
  insert into public.audit_logs(
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,user_agent,after_json,membership_id,
    granted_via,created_at
  ) values (
    gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,
    p_operator_user_id,'admin','catalog.source_sync','catalog_source',p_source,
    p_request_id,left(coalesce(p_user_agent,''),300),jsonb_build_object(
      'source',p_source,'itemsWritten',written_count,
      'requiredPermissions',jsonb_build_array(
        'product.publish','price.update','inventory.update'
      )
    ),p_membership_id,p_granted_via,now_at
  );
  return response_json;
end;
$$;

revoke all on function public.api_upsert_supplier_catalog(text,text,text,text,text,text,jsonb,text,text,text,text,text,jsonb)
from public,anon,authenticated;
grant execute on function public.api_upsert_supplier_catalog(text,text,text,text,text,text,jsonb,text,text,text,text,text,jsonb)
to service_role;

-- Test-data and direct-table maintenance paths are not part of the production
-- dependency graph after the canonical cutover.
revoke all on function public.api_import_test_catalog(jsonb)
from public,anon,authenticated,service_role;
revoke all on function public.api_test_catalog_stats()
from public,anon,authenticated,service_role;
revoke all on function public.purge_test_catalog(text)
from public,anon,authenticated,service_role;
drop function public.api_import_test_catalog(jsonb);
drop function public.api_test_catalog_stats();
drop function public.purge_test_catalog(text);

revoke all on table public.inventory from public,anon,authenticated,service_role;
drop table public.inventory;

notify pgrst,'reload schema';
