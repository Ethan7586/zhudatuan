import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import { allParallel } from '@shop/kernel';
import type { CatalogReadPort } from '../../../catalog/public/CatalogReadPort';
import type { ExperienceReadPort } from '../../../experience/public/ExperienceReadPort';
import type { InventoryReadPort } from '../../../inventory/public/InventoryReadPort';
import type { PricingReadPort } from '../../../pricing/public/PricingReadPort';
import type { CatalogQualificationPort } from '../../../qualification/public';
import type { StorefrontEntry } from '../../../experience/public/ExperienceReadPort';
import { CatalogMapper } from './CatalogMapper';
import { assertEntryMall, entryHandle } from './EntryHandle';

export class CatalogQuery {
  constructor(
    private readonly experience: ExperienceReadPort,
    private readonly catalog: CatalogReadPort,
    private readonly pricing: PricingReadPort,
    private readonly inventory: InventoryReadPort,
    private readonly qualification: CatalogQualificationPort,
    private readonly mapper: CatalogMapper
  ) {}

  entry(context: HandlerContext<'storefront.catalog.read'>): Promise<StorefrontEntry> {
    return this.experience.resolveEntry(context.transaction, entryHandle(context));
  }

  async execute(input: OperationInputFor<'storefront.catalog.read'>, context: HandlerContext<'storefront.catalog.read'>, resolved?: StorefrontEntry) {
    const binding = resolved ?? (await this.entry(context));
    assertEntryMall(context, binding.mall);
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
    const [page, categories] = await allParallel(
      [
        () => this.catalog.listings(context.transaction, { mall: binding.mall, pool: binding.pool, limit, after: cursor, product, listings, query, category, account, exclusive }),
        () => (product || listings ? Promise.resolve(Object.freeze([])) : this.catalog.categories(context.transaction, { mall: binding.mall, pool: binding.pool, query, account, exclusive })),
      ] as const,
      { concurrency: 2, expiresAt: context.deadline, signal: context.signal }
    );
    const skus = page.items.map(({ sku }) => sku);
    const subjects = page.items.map((item) => Object.freeze({ listing: item.id, product: item.product, category: item.categoryId, partner: item.supplierId, regions: strings(item.attributes.regions) }));
    const [prices, availability, qualifications] = await allParallel(
      [
        () => settle(() => this.pricing.prices(context.transaction, binding.mall, skus)),
        () => settle(() => this.inventory.availability(context.transaction, binding.mall, skus)),
        () => settle(() => this.qualification.decisions(context.transaction, binding.mall, subjects)),
      ] as const,
      {
        concurrency: 3,
        expiresAt: context.deadline,
        signal: context.signal,
      }
    );
    const priceRows = fulfilled(prices);
    const availabilityRows = fulfilled(availability);
    const qualificationRows = fulfilled(qualifications);
    const items = this.mapper.items(page.items, priceRows, availabilityRows, qualificationRows, {
      pricing: prices.status === 'fulfilled',
      inventory: availability.status === 'fulfilled',
      qualification: qualifications.status === 'fulfilled',
    });
    return {
      status: 200,
      body: Object.freeze({ items, categories, nextCursor: this.mapper.encode(page.next), version: combinationVersion(binding.version, priceRows, availabilityRows, qualificationRows), asOf: new Date().toISOString() }),
      headers: { 'cache-control': context.security.kind === 'session' ? 'private,no-store' : 'public,max-age=30,stale-while-revalidate=60' },
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

function combinationVersion(binding: string, prices: readonly { version: string }[], stock: readonly { version: string }[], qualifications: readonly { policyVersion: number }[]): string {
  return [binding, ...prices.map(({ version }) => version), ...stock.map(({ version }) => version), ...qualifications.map(({ policyVersion }) => `qualification:${policyVersion}`)].sort().join(':');
}

async function settle<T>(read: () => Promise<T>): Promise<PromiseSettledResult<T>> {
  try {
    return { status: 'fulfilled', value: await read() };
  } catch (reason) {
    return { status: 'rejected', reason };
  }
}

function fulfilled<T>(result: PromiseSettledResult<readonly T[]>): readonly T[] {
  return result.status === 'fulfilled' ? result.value : Object.freeze([]);
}

function strings(value: unknown): readonly string[] {
  return Object.freeze(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
}
