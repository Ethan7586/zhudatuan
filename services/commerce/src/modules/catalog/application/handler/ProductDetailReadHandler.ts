import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { CatalogInventoryPort } from '../../../inventory/public';
import type { CatalogPricingPort } from '../../../pricing/public';
import type { CatalogQualificationPort } from '../../../qualification/public';
import type { ProductDetailBase, ProductRepository } from '../port/ProductRepository';

type DetailSection = NonNullable<OperationInputFor<'catalog.product.detail.read'>['query']>['section'];
type Partition<T> = Readonly<{ state: 'ready' | 'unavailable' | 'notrequested'; rows: readonly T[] }>;

export class ProductDetailReadHandler implements OperationHandler<'catalog.product.detail.read', 'read'> {
  readonly operation = 'catalog.product.detail.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly products: ProductRepository,
    private readonly inventory: CatalogInventoryPort,
    private readonly pricing: CatalogPricingPort,
    private readonly qualifications: CatalogQualificationPort
  ) {}

  async execute(input: OperationInputFor<'catalog.product.detail.read'>, context: HandlerContext<'catalog.product.detail.read'>): Promise<OperationReply<OperationOutputFor<'catalog.product.detail.read'>>> {
    const access = requireSession(context.security);
    const section = input.query?.section;
    if (section === undefined) throw new DomainError('VALIDATION_FAILED', { field: 'section' });
    const detail = await this.products.detail(context.transaction, input.path.productid, access.scope.id, access.scope.kind === 'store');
    const skus = detail.skus.map(({ id }) => id);
    const inventory = await partition(section === 'inventory', () => this.inventory.stock(context.transaction, skus, detail.visibleScopes));
    const pricing = await partition(section === 'pricing', () => this.pricing.prices(context.transaction, skus, detail.visibleScopes));
    const qualification = await partition(section === 'qualification', () => this.qualifications.decisions(context.transaction, access.scope.id, qualificationSubjects(detail)));
    const { visibleScopes: _visibleScopes, regionIds: _regionIds, ...base } = detail;
    const gaps = Object.freeze([
      ...(inventory.state === 'unavailable' ? [{ dependency: 'inventory' as const, code: 'DEPENDENCY_UNAVAILABLE' }] : []),
      ...(pricing.state === 'unavailable' ? [{ dependency: 'pricing' as const, code: 'DEPENDENCY_UNAVAILABLE' }] : []),
      ...(qualification.state === 'unavailable' ? [{ dependency: 'qualification' as const, code: 'DEPENDENCY_UNAVAILABLE' }] : []),
    ]);
    const body = Object.freeze({
      section,
      ...base,
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

function qualificationSubjects(detail: ProductDetailBase) {
  return Object.freeze(
    detail.listings.map((listing) =>
      Object.freeze({ listing: listing.id, product: detail.id, category: detail.category_id, partner: detail.owner_partner_id, regions: detail.regionIds })
    )
  );
}
