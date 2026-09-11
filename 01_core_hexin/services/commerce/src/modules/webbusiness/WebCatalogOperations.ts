import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, type OperationActions } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import {
  CATALOG_LISTING_MANAGEMENT_STATUS_SQL,
  catalogListingPageResult,
  type CatalogListingStatusSummary,
} from '../catalog/03_application_yingyong/CatalogListingManagement';
import { WEB_CATALOG_OPERATION_IDS } from './WebBusinessOperationIds';

export function webCatalogOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('catalog', pool, context.container.get(AUDIT_SINK), webCatalogActions(), WEB_CATALOG_OPERATION_IDS);
}

export function webCatalogActions(): OperationActions {
  return {
    'catalog.listings.read': async (request, database) => {
      const access = requireAccess(request);
      const query = queryValue(request.input.query.q);
      const category = queryValue(request.input.query.category);
      const product = queryValue(request.input.query.product);
      const poolFilter = queryValue(request.input.query.pool);
      const status = queryValue(request.input.query.status);
      const view = queryValue(request.input.query.view);
      const storefront = access.actor.target === 'storefront';
      const page = queryPage(request);
      if (!storefront && view === 'supply-network') {
        const network = await database.query<{ preview: unknown }>(
          'select catalog.console_supply_network($1) preview', [access.scope.id],
        );
        return { status: 200, body: {
          items: [], count: 0,
          ...(network.rows[0]?.preview === undefined ? {} : { preview: network.rows[0].preview }),
        } };
      }
      if (access.scope.kind === 'supplier') {
        const result = await database.query(
          `select source.id,source.sku_id,coalesce(product.title,source.external_id) title,
        source.status,source.source_version version,source.observed_at cursor_sort,sku.code,product.id product_id,product.product_type,
        product.attributes->>'coverUrl' cover_url,product.attributes->>'subtitle' subtitle from catalog.sourcelisting source
        left join catalog.sku sku on sku.id=source.sku_id left join catalog.product product on product.id=sku.product_id where source.scope_id=$1
        and ($2='' or product.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%' or source.external_id ilike '%'||$2||'%')
        and ($3='' or product.category_id=$3) and ($4='' or product.id=$4)
        and ($5::timestamptz is null or (source.observed_at,source.id)<($5::timestamptz,$6)) order by source.observed_at desc,source.id desc limit $7`,
          [access.scope.id, query, category, product, page.sort, page.id, page.fetch],
        );
        return keysetResult(result, page, 'cursor_sort');
      }
      const result = await database.query(
        `select listing.id,listing.pool_id,listing.sku_id,listing.title,listing.status,listing.effective_at,listing.expires_at,listing.version,listing.updated_at cursor_sort,
        sku.code,product.id product_id,product.product_type,product.attributes->>'coverUrl' cover_url,
        product.attributes->>'subtitle' subtitle,
        (select count(*)::integer from catalog.sku productsku where productsku.product_id=product.id) sku_count,
        ${CATALOG_LISTING_MANAGEMENT_STATUS_SQL} management_status
        from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
        join catalog.product product on product.id=sku.product_id where (exists(select 1 from organization.unitclosure where ancestor_id=$1 and descendant_id=listing.scope_id)
          or ($11 and exists(select 1 from organization.unitclosure where ancestor_id=listing.scope_id and descendant_id=$1)))
        and ($2='' or listing.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%') and ($3='' or product.category_id=$3) and ($4='' or product.id=$4)
        and ($5='' or listing.pool_id=$5) and (not $6 or (listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
          and (listing.expires_at is null or listing.expires_at>clock_timestamp())))
        and ($7='' or (${CATALOG_LISTING_MANAGEMENT_STATUS_SQL})=$7)
        and ($8::timestamptz is null or (listing.updated_at,listing.id)<($8::timestamptz,$9))
        order by listing.updated_at desc,listing.id desc limit $10`,
        [access.scope.id, query, category, product, poolFilter, storefront, status, page.sort, page.id, page.fetch, access.scope.kind === 'store'],
      );
      if (storefront) return keysetResult(result, page, 'cursor_sort');
      const summary = await database.query<CatalogListingStatusSummary>(`with classified as materialized (
        select ${CATALOG_LISTING_MANAGEMENT_STATUS_SQL} management_status
        from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
        join catalog.product product on product.id=sku.product_id where
        (exists(select 1 from organization.unitclosure where ancestor_id=$1 and descendant_id=listing.scope_id)
          or ($6 and exists(select 1 from organization.unitclosure where ancestor_id=listing.scope_id and descendant_id=$1)))
        and ($2='' or listing.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%') and ($3='' or product.category_id=$3)
        and ($4='' or product.id=$4) and ($5='' or listing.pool_id=$5)
      ) select count(*)::integer total_count,
        count(*) filter(where management_status='needs_attention')::integer needs_attention,
        count(*) filter(where management_status='pending_review')::integer pending_review,
        count(*) filter(where management_status='published')::integer published,
        count(*) filter(where management_status='unpublished')::integer unpublished
        from classified`,
      [access.scope.id, query, category, product, poolFilter, access.scope.kind === 'store']);
      return catalogListingPageResult(result, page, summary.rows[0]);
    },
  };
}

function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 200) ?? '';
}
