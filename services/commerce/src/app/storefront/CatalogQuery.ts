import type { OperationRequest, OperationResult } from '../../foundation/application/OperationExecution';
import { allParallel } from '../../foundation/performance/Parallel';
import type { ReadScope } from '../../foundation/persistence/ReadSession';
import type { CatalogReadPort } from '../../modules/catalog/public/CatalogReadPort';
import type { ExperienceReadPort } from '../../modules/experience/public/ExperienceReadPort';
import type { InventoryReadPort } from '../../modules/inventory/public/InventoryReadPort';
import type { PricingReadPort } from '../../modules/pricing/public/PricingReadPort';
import { canonicalHost } from './BootstrapQuery';
import { CatalogMapper } from './CatalogMapper';

export class CatalogQuery {
  constructor(
    private readonly experience: ExperienceReadPort,
    private readonly catalog: CatalogReadPort,
    private readonly pricing: PricingReadPort,
    private readonly inventory: InventoryReadPort,
    private readonly mapper: CatalogMapper
  ) {}

  async execute(request: OperationRequest): Promise<OperationResult> {
    const binding = await this.experience.resolveHost(canonicalHost(request.input.headers));
    const limit = integer(request.input.query.limit, 24);
    if (limit < 1 || limit > 50) throw new Error('STOREFRONT_CATALOG_LIMIT_INVALID');
    const product = optional(request.input.query.productId);
    const listings = identifiers(request.input.query.listingIds);
    const query = optional(request.input.query.q);
    const category = optional(request.input.query.categoryId);
    const account = paymentAccount(request.input.query.account);
    const exclusive = flag(request.input.query.exclusive);
    const cursor = this.mapper.decode(optional(request.input.query.cursor));
    if (listings && (product || query || category || account || exclusive || cursor)) throw new Error('STOREFRONT_CATALOG_FILTER_CONFLICT');
    const scope = readScope(request, binding.tenant, binding.mall);
    const page = await this.catalog.listings(scope, { mall: binding.mall, pool: binding.pool, limit, after: cursor, product, listings, query, category, account, exclusive });
    const skus = page.items.map(({ sku }) => sku);
    const [prices, availability] = await allParallel([() => this.pricing.prices(scope, binding.mall, skus), () => this.inventory.availability(scope, binding.mall, skus)] as const, {
      concurrency: 2,
      expiresAt: request.input.deadline,
      signal: request.input.signal,
    });
    const items = this.mapper.items(page.items, prices, availability);
    return {
      status: 200,
      body: Object.freeze({ items, nextCursor: this.mapper.encode(page.next), version: combinationVersion(binding.version, prices, availability), asOf: new Date().toISOString() }),
      headers: { 'cache-control': 'public,max-age=30,stale-while-revalidate=60' },
    };
  }
}

function readScope(request: OperationRequest, tenant: string, mall: string): ReadScope {
  if (request.security.kind === 'session') {
    const access = request.security.access;
    return Object.freeze({ tenant, membership: access.membership.id, scope: mall, actor: access.actor.id, trace: access.trace, operation: request.type });
  }
  return Object.freeze({ tenant, membership: '', scope: mall, actor: 'public:storefront', trace: request.security.trace, operation: request.type });
}

function optional(value: string | readonly string[] | undefined): string | null {
  const selected = Array.isArray(value) ? value[0] : value;
  return typeof selected === 'string' && selected.trim() ? selected.trim().slice(0, 512) : null;
}

function integer(value: string | readonly string[] | undefined, fallback: number): number {
  const parsed = Number(optional(value) ?? fallback);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function identifiers(value: string | readonly string[] | undefined): readonly string[] | null {
  const selected = Array.isArray(value) ? value[0] : value;
  if (typeof selected !== 'string' || selected.trim() === '') return null;
  const values = [...new Set(selected.split(',').map((item) => item.trim()))];
  if (values.length < 1 || values.length > 50 || values.some((item) => !/^[^\s,]{1,256}$/.test(item))) {
    throw new Error('STOREFRONT_CATALOG_LISTINGS_INVALID');
  }
  return Object.freeze(values);
}

function paymentAccount(value: string | readonly string[] | undefined): 'welfare' | 'meal' | 'wechat' | 'cash' | null {
  const selected = optional(value);
  if (selected === null) return null;
  if (!['welfare', 'meal', 'wechat', 'cash'].includes(selected)) throw new Error('STOREFRONT_CATALOG_ACCOUNT_INVALID');
  return selected as 'welfare' | 'meal' | 'wechat' | 'cash';
}

function flag(value: string | readonly string[] | undefined): boolean {
  const selected = optional(value);
  if (selected === null || selected === 'false') return false;
  if (selected === 'true') return true;
  throw new Error('STOREFRONT_CATALOG_FLAG_INVALID');
}

function combinationVersion(binding: string, prices: readonly { version: string }[], stock: readonly { version: string }[]): string {
  return [binding, ...prices.map(({ version }) => version), ...stock.map(({ version }) => version)].sort().join(':');
}
