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
      if (!storefront && view === 'selection-center') {
        const supplier = queryValue(request.input.query.supplier);
        const brand = queryValue(request.input.query.brand);
        const selection = queryValue(request.input.query.selection);
        const result = await database.query(
          `select source.id,source.sku_id,product.id product_id,product.title,source.status,0::bigint version,
          source.observed_at cursor_sort,sku.code,product.product_type,
          product.attributes->>'coverUrl' cover_url,product.attributes->>'subtitle' subtitle,
          jsonb_build_object(
            'kind','selection-center-v1',
            'categoryId',product.category_id,
            'categoryName',coalesce(nullif(product.attributes->>'categoryName',''),'其他商品'),
            'supplierId',product.owner_partner_id,
            'supplierName',coalesce(nullif(product.attributes->>'supplierName',''),'未标注供应商'),
            'brandId',product.brand_id,
            'brandName',coalesce(nullif(product.attributes->>'brand',''),'未标注品牌'),
            'sourceChannel',coalesce(nullif(product.attributes->>'supplyChannel',''),source.provider),
            'supplyPriceMinor',coalesce(
              case when product.attributes->>'procurementCostMinor'~'^[0-9]+$'
                then (product.attributes->>'procurementCostMinor')::bigint end,offer.amount_minor),
            'suggestedRetailMinor',coalesce(
              case when product.attributes->>'suggestedRetailMinor'~'^[0-9]+$'
                then (product.attributes->>'suggestedRetailMinor')::bigint end,offer.compare_minor,offer.amount_minor),
            'availableStock',stock.available,
            'marketSales30d',case when product.attributes->>'marketSales30d'~'^[0-9]+$'
              then (product.attributes->>'marketSales30d')::bigint end,
            'peerLowestPriceMinor',case when product.attributes->>'peerLowestPriceMinor'~'^[0-9]+$'
              then (product.attributes->>'peerLowestPriceMinor')::bigint end,
            'mallSales30d',case when product.attributes->>'mallSales30d'~'^[0-9]+$'
              then (product.attributes->>'mallSales30d')::bigint end,
            'clickThroughRateBps',case when product.attributes->>'clickThroughRateBps'~'^[0-9]+$'
              then (product.attributes->>'clickThroughRateBps')::bigint end,
            'recommendationScore',case when product.attributes->>'recommendationScore'~'^[0-9]+$'
              then (product.attributes->>'recommendationScore')::bigint end,
            'salesGrowthBps',case when product.attributes->>'salesGrowthBps'~'^[0-9]+$'
              then (product.attributes->>'salesGrowthBps')::bigint end,
            'selected',selected.id is not null
          ) selection
          from catalog.sourcelisting source
          join catalog.sku sku on sku.id=source.sku_id and sku.status='active'
          join catalog.product product on product.id=sku.product_id and product.status='active'
          left join catalog.listing selected on selected.scope_id=$1 and selected.sku_id=sku.id
            and selected.status<>'retired'
          left join lateral (
            select price.amount_minor,price.compare_minor from pricing.pricebook book
            join pricing.price price on price.book_id=book.id
            where book.scope_id=$1 and book.status='active' and price.sku_id=sku.id
              and price.effective_at<=clock_timestamp()
              and (price.expires_at is null or price.expires_at>clock_timestamp())
            order by price.effective_at desc,price.id limit 1
          ) offer on true
          left join lateral (
            select coalesce(sum(greatest(item.onhand-item.safety,0)),0)::bigint available
            from inventory.stockitem item where item.scope_id=$1 and item.sku_id=sku.id and item.status='active'
          ) stock on true
          where source.scope_id=$1 and source.status='mapped'
            and ($2='' or product.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%'
              or (product.attributes->>'brand') ilike '%'||$2||'%'
              or coalesce(product.attributes->>'supplierName','') ilike '%'||$2||'%')
            and ($3='' or product.category_id=$3)
            and ($4='' or product.owner_partner_id=$4)
            and ($5='' or product.brand_id=$5 or (product.attributes->>'brand')=$5)
            and ($6='' or ($6='selected' and selected.id is not null)
              or ($6='available' and selected.id is null))
            and ($7::timestamptz is null or (source.observed_at,source.id)<($7::timestamptz,$8))
          order by source.observed_at desc,source.id desc limit $9`,
          [access.scope.id, query, category, supplier, brand, selection, page.sort, page.id, page.fetch],
        );
        return keysetResult(result, page, 'cursor_sort');
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
      const directListingPage = query === '' && category === '' && product === ''
        && (status === '' || status === 'published' || status === 'unpublished');
      const result = directListingPage ? await database.query(
        `with listing_page as materialized(
          select listing.* from catalog.listing listing where
          (exists(select 1 from organization.unitclosure where ancestor_id=$1 and descendant_id=listing.scope_id)
            or ($3 and exists(select 1 from organization.unitclosure where ancestor_id=listing.scope_id and descendant_id=$1)))
          and ($2='' or listing.pool_id=$2)
          and ($6='' or ($6='published' and listing.status='published')
            or ($6='unpublished' and listing.status in('unpublished','retired')))
          and ($4::timestamptz is null or (listing.updated_at,listing.id)<($4::timestamptz,$5))
          order by listing.updated_at desc,listing.id desc limit $7
        ) select listing.id,listing.pool_id,listing.sku_id,listing.title,listing.status,listing.effective_at,listing.expires_at,listing.version,listing.updated_at cursor_sort,
        sku.code,product.id product_id,product.product_type,product.attributes->>'coverUrl' cover_url,
        product.attributes->>'subtitle' subtitle,
        (select count(*)::integer from catalog.sku productsku where productsku.product_id=product.id) sku_count,
        ${CATALOG_LISTING_MANAGEMENT_STATUS_SQL} management_status
        from listing_page listing join catalog.sku sku on sku.id=listing.sku_id
        join catalog.product product on product.id=sku.product_id
        order by listing.updated_at desc,listing.id desc`,
        [access.scope.id, poolFilter, access.scope.kind === 'store', page.sort, page.id, status, page.fetch],
      ) : await database.query(
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
      const directSummary = query === '' && category === '' && product === '';
      const summary = directSummary ? await database.query<CatalogListingStatusSummary>(`with scoped_listing as materialized(
        select listing.* from catalog.listing listing where
        (exists(select 1 from organization.unitclosure where ancestor_id=$1 and descendant_id=listing.scope_id)
          or ($3 and exists(select 1 from organization.unitclosure where ancestor_id=listing.scope_id and descendant_id=$1)))
        and ($2='' or listing.pool_id=$2)
      ), listing_counts as(
        select count(*)::integer total_count,
        count(*) filter(where status='published')::integer published,
        count(*) filter(where status in('unpublished','retired'))::integer unpublished
        from scoped_listing
      ), draft_classified as materialized(
        select ${CATALOG_LISTING_MANAGEMENT_STATUS_SQL} management_status
        from scoped_listing listing join catalog.sku sku on sku.id=listing.sku_id
        join catalog.product product on product.id=sku.product_id where listing.status='draft'
      ), draft_counts as(
        select count(*) filter(where management_status='needs_attention')::integer needs_attention,
        count(*) filter(where management_status='pending_review')::integer pending_review from draft_classified
      ) select listing_counts.total_count,draft_counts.needs_attention,draft_counts.pending_review,
        listing_counts.published,listing_counts.unpublished from listing_counts cross join draft_counts`,
      [access.scope.id, poolFilter, access.scope.kind === 'store']) : await database.query<CatalogListingStatusSummary>(`with classified as materialized (
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
