import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ListingRepository } from '../port/ListingRepository';
import type { CatalogInventoryPort } from '../../../inventory/public';
import type { CatalogPricingPort } from '../../../pricing/public';
import type { CatalogQualificationPort } from '../../../qualification/public';
import type { CatalogPartnerPort } from '../../../partner/public';
import { currentListingPrice, saleableListingStock } from '../model/ListingAvailability';
import type { ProductMedia } from '../service/ProductMedia';

export class ListingsReadHandler implements OperationHandler<'catalog.listings.read', 'read'> {
  readonly operation = 'catalog.listings.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly listings: ListingRepository,
    private readonly inventory: CatalogInventoryPort,
    private readonly pricing: CatalogPricingPort,
    private readonly qualifications: CatalogQualificationPort,
    private readonly partners: Pick<CatalogPartnerPort, 'names'>,
    private readonly media: Pick<ProductMedia, 'links'>
  ) {}
  async execute(input: OperationInputFor<'catalog.listings.read'>, context: HandlerContext<'catalog.listings.read'>): Promise<OperationReply<OperationOutputFor<'catalog.listings.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const query = input.query ?? {};
    const records = await this.listings.read(context.transaction, {
      scope: access.scope.id,
      scopeKind: access.scope.kind,
      actorTarget: access.actor.target,
      query: queryValue(query.q),
      category: queryValue(query.category),
      product: queryValue(query.product),
      pool: queryValue(query.pool),
      supplier: queryValue(query.supplier),
      mall: queryValue(query.mall),
      status: queryValue(query.status),
      page,
    });
    const rows = await enrich(records, access.scope.id, context.transaction, this.inventory, this.pricing, this.qualifications, this.partners, this.media);
    return { status: 200, body: keysetPage(rows, page, 'cursor_sort') as unknown as OperationOutputFor<'catalog.listings.read'> };
  }
}

async function enrich(
  records: readonly Readonly<Record<string, unknown>>[],
  accessScope: string,
  context: Parameters<CatalogInventoryPort['stock']>[0],
  inventory: CatalogInventoryPort,
  pricing: CatalogPricingPort,
  qualifications: CatalogQualificationPort,
  partners: Pick<CatalogPartnerPort, 'names'>,
  media: Pick<ProductMedia, 'links'>
): Promise<readonly Readonly<Record<string, unknown>>[]> {
  if (records.length === 0) return Object.freeze([]);
  const skus = [...new Set(records.flatMap((row) => (typeof row.sku_id === 'string' ? [row.sku_id] : [])))];
  const scopes = [...new Set(records.flatMap((row) => (Array.isArray(row.visible_scopes) ? row.visible_scopes.filter((item): item is string => typeof item === 'string') : [])))];
  const partnerIds = [...new Set(records.flatMap((row) => (typeof row.source_partner_id === 'string' ? [row.source_partner_id] : [])))];
  const coverObjects = [...new Set(records.flatMap((row) => (typeof row.cover_object === 'string' ? [row.cover_object] : [])))];
  const subjects = records.flatMap((row) =>
    typeof row.product_id === 'string' && typeof row.category_id === 'string'
      ? [
          {
            listing: String(row.id),
            product: row.product_id,
            category: row.category_id,
            partner: typeof row.source_partner_id === 'string' ? row.source_partner_id : null,
            regions: Array.isArray(row.region_ids) ? row.region_ids.filter((item): item is string => typeof item === 'string') : [],
          },
        ]
      : []
  );
  const [stockresult, priceresult, qualificationresult, partnerresult, mediaresult] = await Promise.allSettled([
    inventory.stock(context, skus, scopes),
    pricing.prices(context, skus, scopes),
    qualifications.decisions(context, accessScope, subjects),
    partners.names(context, partnerIds),
    media.links(coverObjects),
  ]);
  const stock = stockresult.status === 'fulfilled' ? stockresult.value : [];
  const prices = priceresult.status === 'fulfilled' ? priceresult.value : [];
  const decisions = qualificationresult.status === 'fulfilled' ? new Map(qualificationresult.value.map((item) => [item.listing, item])) : new Map();
  const partnerNames = partnerresult.status === 'fulfilled' ? partnerresult.value : new Map<string, string>();
  const mediaLinks = mediaresult.status === 'fulfilled' ? mediaresult.value : new Map<string, string>();
  const pricesByListing = new Map<string, Readonly<Record<string, unknown>>>();
  for (const price of prices) {
    if (typeof price.sku !== 'string' || typeof price.scope !== 'string' || !currentListingPrice(price)) continue;
    const key = listingKey(price.scope, price.sku);
    const current = pricesByListing.get(key);
    if (current === undefined || Number(price.amountMinor) < Number(current.amountMinor)) pricesByListing.set(key, price);
  }
  const stockByListing = new Map<string, number>();
  for (const item of stock) {
    if (typeof item.sku !== 'string' || typeof item.scope !== 'string') continue;
    const saleable = saleableListingStock(item);
    if (saleable === null) continue;
    const key = listingKey(item.scope, item.sku);
    stockByListing.set(key, (stockByListing.get(key) ?? 0) + saleable);
  }
  return Object.freeze(
    records.map((row) => {
      const sku = typeof row.sku_id === 'string' ? row.sku_id : null;
      const scope = typeof row.scope_id === 'string' ? row.scope_id : null;
      const key = sku === null || scope === null ? null : listingKey(scope, sku);
      const price = key === null ? undefined : pricesByListing.get(key);
      const saleable = key === null ? null : (stockByListing.get(key) ?? null);
      const decision = decisions.get(String(row.id));
      const gaps = [
        ...(row.pool_id === null ? ['pool_missing'] : []),
        ...(stockresult.status === 'rejected' ? ['inventory_unavailable'] : saleable === null ? ['inventory_missing'] : []),
        ...(priceresult.status === 'rejected' ? ['pricing_unavailable'] : price === undefined ? ['price_missing'] : []),
        ...(qualificationresult.status === 'rejected' ? ['qualification_unavailable'] : decision?.eligible === false ? ['qualification_failed'] : []),
      ];
      const coverObject = typeof row.cover_object === 'string' ? row.cover_object : null;
      const { visible_scopes: _scopes, region_ids: _regions, cover_object: _coverObject, ...record } = row;
      return Object.freeze({
        ...record,
        cover_url: (coverObject === null ? undefined : mediaLinks.get(coverObject)) ?? (typeof row.cover_url === 'string' ? row.cover_url : null),
        source_partner_name: typeof row.source_partner_id === 'string' ? (partnerNames.get(row.source_partner_id) ?? null) : null,
        sku_count: count(row.sku_count),
        sku_total: count(row.sku_total),
        mall_count: count(row.mall_count),
        mall_total: count(row.mall_total),
        price_amount_minor: price === undefined ? null : count(price.amountMinor),
        price_currency: price === undefined || typeof price.currency !== 'string' ? null : price.currency,
        price_version: price === undefined ? null : count(price.priceVersion),
        saleable_stock: saleable,
        qualification_eligible: decision?.eligible ?? null,
        data_gaps: Object.freeze(gaps),
      });
    })
  );
}

function listingKey(scope: string, sku: string): string {
  return `${scope}\u0000${sku}`;
}

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function queryValue(value: unknown): string {
  return (Array.isArray(value) ? value[0] : value)?.toString().trim().slice(0, 200) ?? '';
}
