import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ListingFilter } from '../../application/port/ListingRepository';

export async function readSupplierListings(database: SqlExecutor, filter: ListingFilter) {
  const result = await database.query<Record<string, unknown>>(
    `with supplieritems as(
      select 'listing' record_kind,listing.id,listing.scope_id,array[listing.scope_id]::text[] visible_scopes,
      listing.pool_id,listing.sku_id,listing.title,listing.status,listing.version::text version,listing.updated_at cursor_sort,
      sku.code,product.id product_id,product.product_type,product.attributes->>'coverUrl' cover_url,
      product.attributes->>'subtitle' subtitle,product.category_id,category.name category_name,
      case when product.owner_partner_id is null then 'self' else 'partner' end source,
      product.owner_partner_id source_partner_id,pool.name pool_name,
      (select count(*)::integer from catalog.sku item where item.product_id=product.id and item.status='active') sku_count,
      (select count(*)::integer from catalog.sku item where item.product_id=product.id and item.status<>'archived') sku_total,
      0::integer mall_count,1::integer mall_total,coalesce(product.attributes->'regionIds','[]'::jsonb) region_ids,
      listing.effective_at,listing.expires_at
      from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
      join catalog.product product on product.id=sku.product_id join catalog.category category on category.id=product.category_id
      left join catalog.pool pool on pool.id=listing.pool_id where listing.scope_id=$1
      union all
      select 'source' record_kind,source.id,source.scope_id,array[source.scope_id]::text[] visible_scopes,
      null::text pool_id,source.sku_id,coalesce(product.title,source.external_id) title,source.status,
      source.source_version version,source.observed_at cursor_sort,sku.code,product.id product_id,product.product_type,
      product.attributes->>'coverUrl' cover_url,product.attributes->>'subtitle' subtitle,product.category_id,
      category.name category_name,source.provider source,product.owner_partner_id source_partner_id,null::text pool_name,
      case when source.sku_id is null then 0 else 1 end::integer sku_count,
      case when source.sku_id is null then 0 else 1 end::integer sku_total,0::integer mall_count,1::integer mall_total,
      coalesce(product.attributes->'regionIds','[]'::jsonb) region_ids,null::timestamptz effective_at,null::timestamptz expires_at
      from catalog.sourcelisting source left join catalog.sku sku on sku.id=source.sku_id
      left join catalog.product product on product.id=sku.product_id left join catalog.category category on category.id=product.category_id
      where source.scope_id=$1
    ) select record_kind,id,scope_id,visible_scopes,pool_id,sku_id,title,status,version,cursor_sort,code,product_id,
      product_type,cover_url,subtitle,category_id,category_name,source,source_partner_id,pool_name,sku_count,sku_total,
      mall_count,mall_total,region_ids,effective_at,expires_at from supplieritems where
      ($2='' or title ilike '%'||$2||'%' or coalesce(code,'') ilike '%'||$2||'%')
      and ($3='' or category_id=$3) and ($4='' or product_id=$4) and ($5='' or pool_id=$5)
      and ($6='' or source=$6) and ($7='' or scope_id=$7) and ($8='' or status=$8)
      and ($9::timestamptz is null or (cursor_sort,id)<($9::timestamptz,$10))
      order by cursor_sort desc,id desc limit $11`,
    [filter.scope, filter.query, filter.category, filter.product, filter.pool, filter.supplier, filter.mall, filter.status, filter.page.sort, filter.page.id, filter.page.fetch]
  );
  return Object.freeze(result.rows.map(project));
}

function project(row: Record<string, unknown>) {
  const { record_kind: kind, ...value } = row;
  if (kind === 'listing') return Object.freeze({ ...value, version: Number(value.version) });
  const { pool_id: _pool, effective_at: _effective, expires_at: _expires, ...source } = value;
  return Object.freeze(source);
}
