import type { QueryResult, QueryResultRow } from 'pg';
import type { OperationResult } from '../../../foundation/application/OperationHandler';
import { keysetResult, type QueryPage } from '../../../foundation/interface/Validation';

export const CATALOG_LISTING_MANAGEMENT_STATUS_SQL = `case
  when listing.status='published' then 'published'
  when listing.status in('unpublished','retired') then 'unpublished'
  when btrim(coalesce(product.title,''))=''
    or btrim(coalesce(listing.title,''))=''
    or btrim(coalesce(product.category_id,''))=''
    or btrim(coalesce(product.attributes->>'description',''))=''
    or (btrim(coalesce(product.attributes->>'coverUrl',''))='' and
      case when jsonb_typeof(product.attributes->'media')='array'
        then jsonb_array_length(product.attributes->'media') else 0 end=0)
    or btrim(coalesce(sku.code,''))=''
    or product.status<>'active'
    or sku.status<>'active'
    or not exists(select 1 from pricing.pricebook book join pricing.price price on price.book_id=book.id
      where book.scope_id=listing.scope_id and book.status='active' and price.sku_id=sku.id
        and price.effective_at<=clock_timestamp() and (price.expires_at is null or price.expires_at>clock_timestamp()))
    or not exists(select 1 from inventory.stockitem stock where stock.scope_id=listing.scope_id
      and stock.sku_id=sku.id and stock.status='active')
    then 'needs_attention'
  else 'pending_review'
end`;

export interface CatalogListingStatusSummary extends QueryResultRow {
  readonly total_count: number;
  readonly needs_attention: number;
  readonly pending_review: number;
  readonly published: number;
  readonly unpublished: number;
}

export function catalogListingPageResult<T extends QueryResultRow>(
  result: QueryResult<T>,
  page: QueryPage,
  summary: CatalogListingStatusSummary | undefined,
): OperationResult {
  const paged = keysetResult(result, page, 'cursor_sort');
  if (paged.body === null || typeof paged.body !== 'object' || Array.isArray(paged.body)) {
    throw new Error('CATALOG_LISTING_PAGE_INVALID');
  }
  const counts = summary ?? { total_count: 0, needs_attention: 0, pending_review: 0, published: 0, unpublished: 0 };
  return {
    ...paged,
    body: {
      ...paged.body,
      total_count: counts.total_count,
      status_counts: {
        needs_attention: counts.needs_attention,
        pending_review: counts.pending_review,
        published: counts.published,
        unpublished: counts.unpublished,
      },
    },
  };
}
