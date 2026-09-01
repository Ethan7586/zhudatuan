import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import { allParallel } from '../../../../foundation/performance/Parallel';
import type { CatalogReadPort } from '../../../catalog/public/CatalogReadPort';
import type { ExperienceReadPort } from '../../../experience/public/ExperienceReadPort';
import type { InventoryReadPort } from '../../../inventory/public/InventoryReadPort';
import type { PricingReadPort } from '../../../pricing/public/PricingReadPort';
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

  async execute(input: OperationInputFor<'storefront.catalog.read'>, context: HandlerContext<'storefront.catalog.read'>) {
    const binding = await this.experience.resolveHost(context.transaction, canonicalHost(context.headers));
    const queryInput = input.query ?? {};
    const limit = integer(queryInput.limit, 24);
    if (limit < 1 || limit > 50) throw new Error('STOREFRONT_CATALOG_LIMIT_INVALID');
    const product = optional(queryInput.productId);
    const listings = identifiers(queryInput.listingIds);
    const query = optional(queryInput.q);
    const category = optional(queryInput.categoryId);
    const account = paymentAccount(queryInput.account);
    const exclusive = flag(queryInput.exclusive);
    const cursor = this.mapper.decode(optional(queryInput.cursor));
    if (listings && (product || query || category || account || exclusive || cursor)) throw new Error('STOREFRONT_CATALOG_FILTER_CONFLICT');
    const page = await this.catalog.listings(context.transaction, { mall: binding.mall, pool: binding.pool, limit, after: cursor, product, listings, query, category, account, exclusive });
    const skus = page.items.map(({ sku }) => sku);
    const [prices, availability] = await allParallel([() => this.pricing.prices(context.transaction, binding.mall, skus), () => this.inventory.availability(context.transaction, binding.mall, skus)] as const, {
      concurrency: 2,
      expiresAt: context.deadline,
      signal: context.signal,
    });
    const items = this.mapper.items(page.items, prices, availability);
    return {
      status: 200,
      body: Object.freeze({ items, nextCursor: this.mapper.encode(page.next), version: combinationVersion(binding.version, prices, availability), asOf: new Date().toISOString() }),
      headers: { 'cache-control': 'public,max-age=30,stale-while-revalidate=60' },
    };
  }
}

function optional(value: unknown): string | null {
  const selected = Array.isArray(value) ? value[0] : value;
  return typeof selected === 'string' && selected.trim() ? selected.trim().slice(0, 512) : null;
}

function integer(value: unknown, fallback: number): number {
  const parsed = Number(optional(value) ?? fallback);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function identifiers(value: unknown): readonly string[] | null {
  const selected = Array.isArray(value) ? value[0] : value;
  if (typeof selected !== 'string' || selected.trim() === '') return null;
  const values = [...new Set(selected.split(',').map((item) => item.trim()))];
  if (values.length < 1 || values.length > 50 || values.some((item) => !/^[^\s,]{1,256}$/.test(item))) {
    throw new Error('STOREFRONT_CATALOG_LISTINGS_INVALID');
  }
  return Object.freeze(values);
}

function paymentAccount(value: unknown): 'welfare' | 'meal' | 'wechat' | 'cash' | null {
  const selected = optional(value);
  if (selected === null) return null;
  if (!['welfare', 'meal', 'wechat', 'cash'].includes(selected)) throw new Error('STOREFRONT_CATALOG_ACCOUNT_INVALID');
  return selected as 'welfare' | 'meal' | 'wechat' | 'cash';
}

function flag(value: unknown): boolean {
  const selected = optional(value);
  if (selected === null || selected === 'false') return false;
  if (selected === 'true') return true;
  throw new Error('STOREFRONT_CATALOG_FLAG_INVALID');
}

function combinationVersion(binding: string, prices: readonly { version: string }[], stock: readonly { version: string }[]): string {
  return [binding, ...prices.map(({ version }) => version), ...stock.map(({ version }) => version)].sort().join(':');
}
