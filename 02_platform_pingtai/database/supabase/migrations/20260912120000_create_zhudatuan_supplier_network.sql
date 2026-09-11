begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:supplier-network:v1'));

insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at)
select supplier.id,mall.id,'supplier',supplier.name,'active',0,clock_timestamp(),clock_timestamp()
from organization.organization mall
cross join (values
  ('partner:supplier:zhudatuan','主打团供应商'),
  ('partner:supplier:cakeuncle','蛋糕叔叔供应链')
) supplier(id,name)
where mall.id='mall:d1708f04df2dd8a61736852c4900fb43' and mall.kind='mall'
on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,status='active',
  version=partner.partner.version+1,updated_at=clock_timestamp();

insert into partner.agreement(id,partner_id,mall_id,contract_ref,contract_hash,capabilities,effective_at,expires_at,status)
select agreement.id,agreement.partner_id,mall.id,agreement.contract_ref,
  encode(digest(agreement.contract_ref||':'||agreement.partner_id||':'||mall.id,'sha256'),'hex'),
  agreement.capabilities,'2026-09-12 00:00:00+08'::timestamptz,null,'active'
from organization.organization mall
cross join (values
  ('agreement:zhudatuan:supplier:direct','partner:supplier:zhudatuan','ZDT-SUPPLY-DIRECT-2026',
    '["catalog","pricing","inventory","ordering","fulfillment","settlement"]'::jsonb),
  ('agreement:zhudatuan:supplier:cakeuncle','partner:supplier:cakeuncle','ZDT-CAKEUNCLE-CHANNEL-2026',
    '["catalog","pricing","inventory","ordering","fulfillment","after_sales","settlement"]'::jsonb)
) agreement(id,partner_id,contract_ref,capabilities)
where mall.id='mall:d1708f04df2dd8a61736852c4900fb43' and mall.kind='mall'
on conflict(id) do update set contract_ref=excluded.contract_ref,contract_hash=excluded.contract_hash,
  capabilities=excluded.capabilities,status='active';

update catalog.product product
set owner_partner_id='partner:supplier:zhudatuan',
  attributes=product.attributes||jsonb_build_object(
    'supplierName','主打团供应商','supplyChannel','主打团自营货盘','settlementMode','月结',
    'settlementCurrency','CNY','supplyRelationship','direct'),
  version=product.version+1,updated_at=clock_timestamp()
where coalesce(product.attributes->>'provider','')<>'cake'
  and exists(select 1 from catalog.sku sku join catalog.listing listing on listing.sku_id=sku.id
    where sku.product_id=product.id and listing.scope_id='mall:d1708f04df2dd8a61736852c4900fb43');

update catalog.product product
set owner_partner_id='partner:supplier:cakeuncle',
  attributes=product.attributes||jsonb_build_object(
    'supplierName','蛋糕叔叔供应链','supplyChannel','Cakeuncle 直连','settlementMode','订单结算',
    'settlementCurrency','CNY','supplyRelationship','channel'),
  version=product.version+1,updated_at=clock_timestamp()
where product.attributes->>'provider'='cake'
  and exists(select 1 from catalog.sku sku join catalog.listing listing on listing.sku_id=sku.id
    where sku.product_id=product.id and listing.scope_id='mall:d1708f04df2dd8a61736852c4900fb43');

insert into catalog.category(id,parent_id,code,name,status,sort_order)
values('category:zdt-daily-trial',null,'daily_trial','日用体验装','active',35)
on conflict(id) do update set code=excluded.code,name=excluded.name,status='active',sort_order=excluded.sort_order;

create temporary table zdt_supplier_trial_product(
  ordinal integer primary key,
  slug text not null unique,
  title text not null,
  subtitle text not null,
  amount_minor bigint not null,
  compare_minor bigint not null,
  procurement_minor bigint not null,
  settlement_minor bigint not null,
  onhand bigint not null
) on commit drop;

insert into zdt_supplier_trial_product values
  (1,'pocket-tissue','便携纸巾体验装','4层柔韧纸巾，随身小包装',100,199,61,72,50000),
  (2,'paper-cup','一次性纸杯试用装','食品接触级纸杯，办公待客装',109,219,66,78,48000),
  (3,'trash-bag','加厚垃圾袋体验装','加厚承重，办公室与家庭通用',119,239,72,86,46000),
  (4,'fresh-bag','食品级保鲜袋体验装','食品接触级材质，便捷抽取',129,259,78,93,44000),
  (5,'scouring-pad','厨房百洁布双片装','双面去污，不易掉屑',139,279,84,100,42000),
  (6,'alcohol-wipe','酒精湿巾便携装','独立便携，日常清洁',149,299,90,107,40000),
  (7,'cotton-swab','棉签旅行装','双头细轴，便携密封装',159,319,96,114,38000),
  (8,'dental-floss','牙线棒随身装','高韧细线，圆滑手柄',169,339,102,122,36000),
  (9,'laundry-pod','洗衣凝珠体验装','浓缩洁净，低泡易漂洗',179,359,108,129,34000),
  (10,'compressed-towel','一次性压缩毛巾双片装','植物纤维，加厚便携',199,399,120,143,32000);

insert into catalog.product(id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
select 'product:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),'partner:supplier:zhudatuan',null,
  'category:zdt-daily-trial',item.title,'physical',jsonb_build_object(
    'spu','ZDT-TRY-'||lpad(item.ordinal::text,3,'0'),'brand','主打团','unit','件',
    'subtitle',item.subtitle,'description',item.subtitle||'。由主打团供应商直接供货。',
    'coverUrl','https://hbbtzn.com/catalog-media/zdt-daily-trial.svg',
    'media',jsonb_build_array(jsonb_build_object('kind','image','url','https://hbbtzn.com/catalog-media/zdt-daily-trial.svg')),
    'supplierName','主打团供应商','supplyChannel','主打团自营货盘','supplyRelationship','direct',
    'settlementMode','月结','settlementCurrency','CNY','procurementCostMinor',item.procurement_minor,
    'settlementAmountMinor',item.settlement_minor,'suggestedRetailMinor',item.compare_minor),
  'active',0,clock_timestamp(),clock_timestamp()
from zdt_supplier_trial_product item
on conflict(id) do update set owner_partner_id=excluded.owner_partner_id,category_id=excluded.category_id,
  title=excluded.title,attributes=excluded.attributes,status='active',version=catalog.product.version+1,
  updated_at=clock_timestamp();

insert into catalog.sku(id,product_id,code,specifications,status,version)
select 'sku:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),
  'product:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),
  'ZDT-TRY-'||lpad(item.ordinal::text,3,'0'),jsonb_build_object('规格','体验装','供货方','主打团供应商'),'active',0
from zdt_supplier_trial_product item
on conflict(id) do update set product_id=excluded.product_id,code=excluded.code,specifications=excluded.specifications,
  status='active',version=catalog.sku.version+1;

insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version,created_at,updated_at)
select 'listing:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),mall.id,
  (select binding.pool_id from catalog.poolbinding binding where binding.mall_id=mall.id and binding.status='active'
    order by binding.effective_at desc nulls last,binding.pool_id limit 1),
  'sku:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),item.title,'published',
  '2026-09-12 00:00:00+08'::timestamptz,null,0,clock_timestamp(),clock_timestamp()
from zdt_supplier_trial_product item
join organization.organization mall on mall.id='mall:d1708f04df2dd8a61736852c4900fb43' and mall.kind='mall'
on conflict(id) do update set pool_id=excluded.pool_id,title=excluded.title,status='published',
  effective_at=excluded.effective_at,expires_at=null,version=catalog.listing.version+1,updated_at=clock_timestamp();

insert into pricing.pricebook(id,scope_id,currency,name,status,version)
select 'pricebook:supplier:zhudatuan:trial',mall.id,'CNY','主打团供应商体验价','active',0
from organization.organization mall
where mall.id='mall:d1708f04df2dd8a61736852c4900fb43' and mall.kind='mall'
on conflict(id) do update set name=excluded.name,status='active',version=pricing.pricebook.version+1;

insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at,expires_at)
select 'price:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),'pricebook:supplier:zhudatuan:trial',
  'sku:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),item.amount_minor,item.compare_minor,
  '2026-09-12 00:00:00+08'::timestamptz,null
from zdt_supplier_trial_product item
where exists(select 1 from pricing.pricebook where id='pricebook:supplier:zhudatuan:trial')
on conflict(id) do update set amount_minor=excluded.amount_minor,compare_minor=excluded.compare_minor,expires_at=null;

insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
select 'stock:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),mall.id,
  'sku:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),'location:zdt:supplier:central',
  item.onhand,greatest((item.onhand*2/100)::bigint,1),0,'active',clock_timestamp()
from zdt_supplier_trial_product item
join organization.organization mall on mall.id='mall:d1708f04df2dd8a61736852c4900fb43' and mall.kind='mall'
on conflict(id) do update set onhand=excluded.onhand,safety=excluded.safety,status='active',
  version=inventory.stockitem.version+1,updated_at=clock_timestamp();

insert into inventory.snapshot(stockitem_id,observed_at,source,onhand,source_version)
select 'stock:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),
  '2026-09-12 00:00:00+08'::timestamptz,'主打团供应商',item.onhand,'supplier-catalog-2026.09.12'
from zdt_supplier_trial_product item
where exists(select 1 from inventory.stockitem where id='stock:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'))
on conflict do nothing;

insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
select 'movement:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),
  'mall:d1708f04df2dd8a61736852c4900fb43','stock:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),
  'receive',item.onhand,'supplier_catalog','partner:supplier:zhudatuan','2026-09-12 00:00:00+08'::timestamptz
from zdt_supplier_trial_product item
where exists(select 1 from inventory.stockitem where id='stock:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'))
on conflict do nothing;

insert into catalog.sourcelisting(id,provider,external_id,object_type,sku_id,scope_id,source_version,source_payload,source_hash,status,observed_at)
select 'source:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),'zhudatuan',
  'ZDT-TRY-'||lpad(item.ordinal::text,3,'0'),'product','sku:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'),
  'mall:d1708f04df2dd8a61736852c4900fb43','supplier-catalog-2026.09.12',
  jsonb_build_object('supplierId','partner:supplier:zhudatuan','title',item.title,'amountMinor',item.amount_minor,'onhand',item.onhand),
  encode(digest(item.slug||':'||item.amount_minor::text||':'||item.onhand::text,'sha256'),'hex'),'mapped',clock_timestamp()
from zdt_supplier_trial_product item
where exists(select 1 from catalog.sku where id='sku:zdt:supplier:trial:'||lpad(item.ordinal::text,3,'0'))
on conflict(id) do update set source_version=excluded.source_version,source_payload=excluded.source_payload,
  source_hash=excluded.source_hash,status='mapped',observed_at=clock_timestamp();

insert into catalog.suppliercategory(id,supplier_id,source_code,source_name,category_id,state,confidence,created_at,updated_at)
values
  ('suppliercategory:zhudatuan:daily-trial','partner:supplier:zhudatuan','daily_trial','日用体验装','category:zdt-daily-trial','reviewed',1,clock_timestamp(),clock_timestamp()),
  ('suppliercategory:cakeuncle:cake','partner:supplier:cakeuncle','cake','蛋糕烘焙',
    (select id from catalog.category where code='food' and status='active' limit 1),'reviewed',1,clock_timestamp(),clock_timestamp())
on conflict(id) do update set supplier_id=excluded.supplier_id,source_code=excluded.source_code,
  source_name=excluded.source_name,category_id=excluded.category_id,state='reviewed',confidence=1,updated_at=clock_timestamp();

create or replace function catalog.console_supply_network(p_scope text)
returns jsonb
language sql stable security definer
set search_path=pg_catalog,catalog,partner,pricing,inventory,organization
set row_security=off
as $function$
  with supplier_metrics as (
    select supplier.id,supplier.name,supplier.status,
      count(distinct product.id) filter(where listing.id is not null)::integer product_count,
      count(distinct sku.id) filter(where listing.id is not null)::integer sku_count,
      count(distinct product.id) filter(where listing.id is not null and product.category_id='category:zdt-daily-trial')::integer trial_product_count,
      count(*) filter(where listing.status='published')::integer published_count,
      coalesce(sum(stock.available),0)::bigint available_stock,
      coalesce(sum(offer.amount_minor*stock.available),0)::bigint inventory_value_minor,
      min(offer.amount_minor)::bigint min_price_minor,max(offer.amount_minor)::bigint max_price_minor,
      case when count(*) filter(where product.attributes->>'provider'='cake')>0
        then 'Cakeuncle 直连' else '主打团自营货盘' end channel,
      coalesce(max(product.attributes->>'settlementMode'),'按协议结算') settlement_mode,
      max(coalesce(source.observed_at,listing.updated_at)) last_synced_at
    from partner.partner supplier
    left join catalog.product product on product.owner_partner_id=supplier.id
    left join catalog.sku sku on sku.product_id=product.id
    left join catalog.listing listing on listing.sku_id=sku.id and listing.scope_id=p_scope
    left join lateral (
      select price.amount_minor
      from pricing.pricebook book join pricing.price price on price.book_id=book.id
      where book.scope_id=p_scope and book.status='active' and price.sku_id=sku.id
        and price.effective_at<=clock_timestamp() and (price.expires_at is null or price.expires_at>clock_timestamp())
      order by price.effective_at desc,price.id limit 1
    ) offer on true
    left join lateral (
      select coalesce(sum(greatest(item.onhand-item.safety-coalesce(reserved.quantity,0),0)),0)::bigint available
      from inventory.stockitem item
      left join lateral (
        select coalesce(sum(reservation.quantity),0)::bigint quantity
        from inventory.reservation reservation
        where reservation.stockitem_id=item.id and reservation.mall_id=p_scope and reservation.state='active'
          and reservation.expires_at>clock_timestamp()
      ) reserved on true
      where item.scope_id=p_scope and item.sku_id=sku.id and item.status='active'
    ) stock on true
    left join catalog.sourcelisting source on source.sku_id=sku.id and source.scope_id=p_scope and source.status='mapped'
    where supplier.scope_id=p_scope and supplier.kind='supplier' and supplier.status='active'
    group by supplier.id,supplier.name,supplier.status
  ), supplier_rows as (
    select metrics.*,agreement.contract_ref,agreement.capabilities,agreement.status agreement_status,
      agreement.effective_at agreement_effective_at
    from supplier_metrics metrics
    left join lateral (
      select value.contract_ref,value.capabilities,value.status,value.effective_at
      from partner.agreement value where value.partner_id=metrics.id and value.mall_id=p_scope
      order by (value.status='active') desc,value.effective_at desc,value.id limit 1
    ) agreement on true
  )
  select jsonb_build_object(
    'kind','console-product-v1','totalCount',coalesce(sum(product_count),0)::integer,
    'asOf',clock_timestamp(),'facets',jsonb_build_object(
      'categories','[]'::jsonb,'malls','[]'::jsonb,'statuses','[]'::jsonb,
      'suppliers',coalesce(jsonb_agg(jsonb_build_object(
        'value',id,'label',name,'count',product_count,'productCount',product_count,'skuCount',sku_count,
        'trialProductCount',trial_product_count,
        'publishedCount',published_count,'availableStock',available_stock,
        'inventoryValueMinor',inventory_value_minor,'minPriceMinor',min_price_minor,'maxPriceMinor',max_price_minor,
        'channel',channel,'settlementMode',settlement_mode,'agreementStatus',coalesce(agreement_status,'draft'),
        'contractRef',contract_ref,'capabilities',coalesce(capabilities,'[]'::jsonb),
        'effectiveAt',agreement_effective_at,'lastSyncedAt',last_synced_at
      ) order by product_count desc,name),'[]'::jsonb)
    ))
  from supplier_rows
$function$;

revoke all on function catalog.console_supply_network(text) from public,anon,authenticated,service_role,
  shopapp,shopjob,shopread,zhudatuanidentityjob,zhudatuanbootstrap,zhudatuansandboxbootstrap;
grant execute on function catalog.console_supply_network(text) to zhudatuanidentityapi,zhudatuanwebapi;

grant usage on schema pricing,inventory to zhudatuanidentityapi;
grant select on pricing.pricebook,pricing.price,inventory.stockitem to zhudatuanidentityapi;
drop policy if exists identityapiread on pricing.pricebook;
drop policy if exists identityapiread on pricing.price;
drop policy if exists identityapiread on inventory.stockitem;
create policy identityapiread on pricing.pricebook for select to zhudatuanidentityapi using(access.scope_allowed(scope_id));
create policy identityapiread on pricing.price for select to zhudatuanidentityapi using(exists(
  select 1 from pricing.pricebook book where book.id=book_id and access.scope_allowed(book.scope_id)));
create policy identityapiread on inventory.stockitem for select to zhudatuanidentityapi using(access.scope_allowed(scope_id));

insert into runtime.schemaversion(version,checksum)
values('20260912120000','c81d1e9f47e4450ea77ae252394725189e51b63472d65a4025ba705147c07d30');

commit;
