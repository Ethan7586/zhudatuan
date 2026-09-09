import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { CatalogInventoryPort } from '../../../inventory/public';
import type { CatalogPricingPort } from '../../../pricing/public';
import type { CatalogQualificationPort } from '../../../qualification/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { ProductDetailBase, ProductRepository } from '../port/ProductRepository';
import { productDetailLabels, type ProductDetailLabels } from '../service/ProductDetailLabels';
import type { ProductMedia } from '../service/ProductMedia';

type DetailSection = NonNullable<OperationInputFor<'catalog.product.detail.read'>['query']>['section'];
type Partition<T> = Readonly<{ state: 'ready' | 'unavailable' | 'notrequested'; rows: readonly T[] }>;

export class ProductDetailReadHandler implements OperationHandler<'catalog.product.detail.read', 'read'> {
  readonly operation = 'catalog.product.detail.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly products: ProductRepository,
    private readonly inventory: CatalogInventoryPort,
    private readonly pricing: CatalogPricingPort,
    private readonly qualifications: CatalogQualificationPort,
    private readonly organizations: Pick<OrganizationReadPort, 'summaries'>,
    private readonly media: Pick<ProductMedia, 'links'>
  ) {}

  async execute(input: OperationInputFor<'catalog.product.detail.read'>, context: HandlerContext<'catalog.product.detail.read'>): Promise<OperationReply<OperationOutputFor<'catalog.product.detail.read'>>> {
    const access = requireSession(context.security);
    const section = input.query?.section;
    if (section === undefined) throw new DomainError('VALIDATION_FAILED', { field: 'section' });
    const detail = await this.products.detail(context.transaction, input.path.productid, access.scope.id, access.scope.kind === 'store');
    const skus = detail.skus.map(({ id }) => id);
    const [organizations, inventoryRows, pricingRows, qualificationRows, mediaLinks] = await Promise.all([
      this.organizations.summaries(context.transaction, detail.visibleScopes),
      partition(section === 'inventory', () => this.inventory.stock(context.transaction, skus, detail.visibleScopes)),
      partition(section === 'pricing', () => this.pricing.prices(context.transaction, skus, detail.visibleScopes)),
      partition(section === 'qualification', () => this.qualifications.decisions(context.transaction, access.scope.id, qualificationSubjects(detail))),
      this.media.links(detail.cover_object === null ? [] : [detail.cover_object]),
    ]);
    const labels = productDetailLabels(detail, organizations);
    const inventory = projectPartition(inventoryRows, (rows) => inventoryProjection(rows, labels));
    const pricing = projectPartition(pricingRows, (rows) => priceProjection(rows, labels));
    const qualification = projectPartition(qualificationRows, (rows) => qualificationProjection(rows, labels));
    const cover = detail.cover_object === null ? undefined : mediaLinks.get(detail.cover_object);
    const media = productMedia(detail.media, cover, detail.title);
    const { visibleScopes: _visibleScopes, regionIds: _regionIds, listings: _listings, timeline: _timeline, cover_object: _coverObject, ...base } = detail;
    const gaps = Object.freeze([
      ...(inventory.state === 'unavailable' ? [{ dependency: 'inventory' as const, code: 'DEPENDENCY_UNAVAILABLE' }] : []),
      ...(pricing.state === 'unavailable' ? [{ dependency: 'pricing' as const, code: 'DEPENDENCY_UNAVAILABLE' }] : []),
      ...(qualification.state === 'unavailable' ? [{ dependency: 'qualification' as const, code: 'DEPENDENCY_UNAVAILABLE' }] : []),
    ]);
    const body = Object.freeze({
      section,
      ...base,
      cover_url: cover ?? detail.cover_url,
      media,
      listings: labels.listings,
      timeline: labels.timeline,
      inventory: Object.freeze(inventory.rows),
      prices: Object.freeze(pricing.rows),
      qualifications: Object.freeze(qualification.rows),
      dependencies: Object.freeze({
        catalog: Object.freeze({ state: 'ready' as const, watermark: String(detail.version), code: null }),
        inventory: dependency(inventory, 'version'),
        pricing: dependency(pricing, 'bookVersion'),
        qualification: dependency(qualification, 'policyVersion'),
      }),
      gaps,
    });
    return { status: 200, body: body as unknown as OperationOutputFor<'catalog.product.detail.read'> };
  }
}

function productMedia(rows: ProductDetailBase['media'], cover: string | undefined, title: string): ProductDetailBase['media'] {
  if (cover === undefined) return rows;
  const withoutPreviousCover = rows.filter((row) => row.id !== 'media:cover' && row.url !== cover);
  return Object.freeze([Object.freeze({ id: 'media:cover', kind: 'image' as const, url: cover, alt: title, sort: 0 }), ...withoutPreviousCover]);
}

async function partition<T>(requested: boolean, read: () => Promise<readonly T[]>): Promise<Partition<T>> {
  if (!requested) return Object.freeze({ state: 'notrequested', rows: Object.freeze([]) });
  try {
    return Object.freeze({ state: 'ready', rows: Object.freeze(await read()) });
  } catch {
    return Object.freeze({ state: 'unavailable', rows: Object.freeze([]) });
  }
}

function dependency(partitionValue: Partition<unknown>, field: string) {
  if (partitionValue.state !== 'ready') return Object.freeze({ state: partitionValue.state, watermark: null, code: partitionValue.state === 'unavailable' ? 'DEPENDENCY_UNAVAILABLE' : null });
  const watermark = partitionValue.rows.reduce<string | null>((current, item) => {
    if (item === null || typeof item !== 'object') return current;
    const value = (item as Readonly<Record<string, unknown>>)[field];
    return value === undefined || value === null ? current : current === null || String(value) > current ? String(value) : current;
  }, null);
  return Object.freeze({ state: 'ready' as const, watermark, code: null });
}

function projectPartition<Input, Output>(partitionValue: Partition<Input>, project: (rows: readonly Input[]) => readonly Output[]): Partition<Output> {
  return Object.freeze({ state: partitionValue.state, rows: partitionValue.state === 'ready' ? Object.freeze(project(partitionValue.rows)) : Object.freeze([]) });
}

function qualificationSubjects(detail: ProductDetailBase) {
  return Object.freeze(detail.listings.map((listing) => Object.freeze({ listing: listing.id, product: detail.id, category: detail.category_id, partner: detail.owner_partner_id, regions: detail.regionIds })));
}

function inventoryProjection(rows: readonly Readonly<Record<string, unknown>>[], labels: ProductDetailLabels) {
  return Object.freeze(
    rows.map(({ sku, scope, location, onhand, safety, status, version }) =>
      Object.freeze({ sku, skuCode: labels.sku(sku), scope, scopeName: labels.scope(scope), location, locationName: labels.location(location), onhand, safety, status, version })
    )
  );
}

function priceProjection(rows: readonly Readonly<Record<string, unknown>>[], labels: ProductDetailLabels) {
  return Object.freeze(
    rows.map(({ sku, scope, currency, amountMinor, compareMinor, bookStatus, effectiveAt, expiresAt, bookVersion, priceVersion }) =>
      Object.freeze({ sku, skuCode: labels.sku(sku), scope, scopeName: labels.scope(scope), currency, amountMinor, compareMinor, bookStatus, effectiveAt, expiresAt, bookVersion, priceVersion })
    )
  );
}

function qualificationProjection(rows: readonly Readonly<{ listing: string; eligible: boolean; policyVersion: number }>[], labels: ProductDetailLabels) {
  return Object.freeze(rows.map(({ listing, eligible, policyVersion }) => Object.freeze({ listing, listingTitle: labels.listing(listing), eligible, policyVersion })));
}
