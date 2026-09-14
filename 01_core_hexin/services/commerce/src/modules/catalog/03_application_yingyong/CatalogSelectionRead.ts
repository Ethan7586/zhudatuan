const selectionProjection = (categoryId: string, categoryName: string, categoryJoin = '') => `
with selection_page as materialized (
  select source.id,source.sku_id,source.status,source.observed_at cursor_sort,source.provider,
    sku.code,product.id product_id,product.title,product.product_type,product.category_id,
    product.owner_partner_id,product.brand_id,product.attributes
  from catalog.sourcelisting source
  join catalog.sku sku on sku.id=source.sku_id and sku.status='active'
  join catalog.product product on product.id=sku.product_id and product.status='active'
  where source.scope_id=$1 and source.status='mapped'
    and ($2='' or product.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%'
      or (product.attributes->>'brand') ilike '%'||$2||'%'
      or coalesce(product.attributes->>'supplierName','') ilike '%'||$2||'%')
    and ($3='' or product.category_id=$3)
    and ($4='' or product.owner_partner_id=$4)
    and ($5='' or product.brand_id=$5 or (product.attributes->>'brand')=$5)
    and ($6='' or ($6='selected' and exists(
      select 1 from catalog.listing selected where selected.scope_id=$1
        and selected.sku_id=source.sku_id and selected.status<>'retired'))
      or ($6='available' and not exists(
        select 1 from catalog.listing selected where selected.scope_id=$1
          and selected.sku_id=source.sku_id and selected.status<>'retired')))
    and ($7::timestamptz is null or (source.observed_at,source.id)<($7::timestamptz,$8))
  order by source.observed_at desc,source.id desc limit $9
)
select candidate.id,candidate.sku_id,candidate.product_id,candidate.title,candidate.status,0::bigint version,
  candidate.cursor_sort,candidate.code,candidate.product_type,
  candidate.attributes->>'coverUrl' cover_url,candidate.attributes->>'subtitle' subtitle,
  jsonb_build_object(
    'kind','selection-center-v1',
    'categoryId',${categoryId},
    'categoryName',${categoryName},
    'supplierId',candidate.owner_partner_id,
    'supplierName',coalesce(nullif(candidate.attributes->>'supplierName',''),'未标注供应商'),
    'brandId',candidate.brand_id,
    'brandName',coalesce(nullif(candidate.attributes->>'brand',''),'未标注品牌'),
    'sourceChannel',coalesce(nullif(candidate.attributes->>'supplyChannel',''),candidate.provider),
    'supplyPriceMinor',coalesce(
      case when candidate.attributes->>'procurementCostMinor'~'^[0-9]+$'
        then (candidate.attributes->>'procurementCostMinor')::bigint end,offer.amount_minor),
    'suggestedRetailMinor',coalesce(
      case when candidate.attributes->>'suggestedRetailMinor'~'^[0-9]+$'
        then (candidate.attributes->>'suggestedRetailMinor')::bigint end,offer.compare_minor,offer.amount_minor),
    'availableStock',stock.available,
    'marketSales30d',coalesce(case when candidate.attributes->>'marketSales30d'~'^[0-9]+$'
      then (candidate.attributes->>'marketSales30d')::bigint end,sample.market_sales_30d),
    'peerLowestPriceMinor',coalesce(case when candidate.attributes->>'peerLowestPriceMinor'~'^[0-9]+$'
      then (candidate.attributes->>'peerLowestPriceMinor')::bigint end,sample.peer_lowest_price_minor),
    'mallSales30d',coalesce(case when candidate.attributes->>'mallSales30d'~'^[0-9]+$'
      then (candidate.attributes->>'mallSales30d')::bigint end,sample.mall_sales_30d),
    'clickThroughRateBps',coalesce(case when candidate.attributes->>'clickThroughRateBps'~'^[0-9]+$'
      then (candidate.attributes->>'clickThroughRateBps')::bigint end,sample.click_through_rate_bps),
    'recommendationScore',coalesce(case when candidate.attributes->>'recommendationScore'~'^[0-9]+$'
      then (candidate.attributes->>'recommendationScore')::bigint end,sample.recommendation_score),
    'salesGrowthBps',coalesce(case when candidate.attributes->>'salesGrowthBps'~'^[0-9]+$'
      then (candidate.attributes->>'salesGrowthBps')::bigint end,sample.sales_growth_bps),
    'selected',selected.id is not null
  ) selection
from selection_page candidate
${categoryJoin}
left join lateral (
  select metrics.* from (values
    (1,18620::bigint,219::bigint,1340::bigint,860::bigint,96::bigint,2100::bigint),
    (2,15380::bigint,209::bigint,1120::bigint,790::bigint,94::bigint,1600::bigint),
    (3,21450::bigint,249::bigint,1680::bigint,1030::bigint,97::bigint,2800::bigint),
    (4,12780::bigint,269::bigint,890::bigint,720::bigint,91::bigint,1200::bigint),
    (5,9820::bigint,275::bigint,620::bigint,680::bigint,87::bigint,900::bigint),
    (6,17640::bigint,319::bigint,1450::bigint,940::bigint,95::bigint,1900::bigint),
    (7,8640::bigint,309::bigint,510::bigint,640::bigint,84::bigint,700::bigint),
    (8,11260::bigint,349::bigint,760::bigint,750::bigint,89::bigint,1100::bigint),
    (9,14320::bigint,369::bigint,980::bigint,810::bigint,93::bigint,1500::bigint),
    (10,10540::bigint,389::bigint,690::bigint,700::bigint,88::bigint,1000::bigint)
  ) metrics(ordinal,market_sales_30d,peer_lowest_price_minor,mall_sales_30d,
    click_through_rate_bps,recommendation_score,sales_growth_bps)
  where candidate.product_id='product:zdt:supplier:trial:'||lpad(metrics.ordinal::text,3,'0')
) sample on true
left join lateral (
  select listing.id from catalog.listing listing
  where listing.scope_id=$1 and listing.sku_id=candidate.sku_id and listing.status<>'retired'
  limit 1
) selected on true
left join lateral (
  select price.amount_minor,price.compare_minor from pricing.pricebook book
  join pricing.price price on price.book_id=book.id
  where book.scope_id=$1 and book.status='active' and price.sku_id=candidate.sku_id
    and price.effective_at<=statement_timestamp()
    and (price.expires_at is null or price.expires_at>statement_timestamp())
  order by price.effective_at desc,price.id limit 1
) offer on true
left join lateral (
  select coalesce(sum(greatest(item.onhand-item.safety,0)),0)::bigint available
  from inventory.stockitem item
  where item.scope_id=$1 and item.sku_id=candidate.sku_id and item.status='active'
) stock on true
order by candidate.cursor_sort desc,candidate.id desc`;

export const CATALOG_SELECTION_CENTER_LISTINGS_SQL = selectionProjection(
  'category.id',
  "coalesce(category.name,'其他商品')",
  'left join catalog.category category on category.id=candidate.category_id',
);

export const WEB_SELECTION_CENTER_LISTINGS_SQL = selectionProjection(
  'candidate.category_id',
  "coalesce(nullif(candidate.attributes->>'categoryName',''),'其他商品')",
);
