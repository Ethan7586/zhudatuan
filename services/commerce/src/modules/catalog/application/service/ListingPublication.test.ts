import { describe, expect, it, vi } from 'vitest';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CatalogInventoryPort } from '../../../inventory/public';
import type { CatalogPricingPort } from '../../../pricing/public';
import type { CatalogQualificationPort } from '../../../qualification/public/CatalogQualificationPort';
import type { ListingCandidate, ListingRepository } from '../port/ListingRepository';
import type { ListingSnapshot } from '../../domain/model/Listing';
import { ListingPublication } from './ListingPublication';

const context = { deadline: Date.now() + 30_000, signal: new AbortController().signal } as WriteTransactionContext;

describe('listing publication', () => {
  it('evaluates qualification, price and inventory concurrently and persists one publish batch', async () => {
    const save = vi.fn(async (_context: WriteTransactionContext, listings: readonly ListingSnapshot[]) => listings.map((listing) => record(listing.id, listing.sku, listing.version, listing.state)));
    const qualifications = port(async (_context, _scope, subjects) => subjects.map((subject) => ({ listing: subject.listing, eligible: true, policyVersion: 4 })));
    const pricing = pricePort(async () => [price('sku:one')]);
    const inventory = stockPort(async () => [stock('sku:one')]);
    const service = new ListingPublication(repository([candidate('listing:one', 'sku:one')], save), qualifications, pricing, inventory);

    const result = await service.change(context, 'mall:one', [{ id: 'listing:one', expectedVersion: 1 }], 'publish', 'principal:one', 'trace:one');

    expect(result.items).toEqual([expect.objectContaining({ id: 'listing:one', state: 'succeeded', status: 'published', version: 2 })]);
    expect(result.events).toHaveLength(1);
    expect(save).toHaveBeenCalledWith(context, [expect.objectContaining({ id: 'listing:one', state: 'published', version: 2 })]);
    expect(qualifications.decisions).toHaveBeenCalledOnce();
    expect(pricing.prices).toHaveBeenCalledOnce();
    expect(inventory.stock).toHaveBeenCalledOnce();
  });

  it('previews and executes valid rows while preserving stable per-row failures', async () => {
    const candidates = [candidate('listing:one', 'sku:one'), candidate('listing:two', 'sku:two'), candidate('listing:three', 'sku:three')];
    const save = vi.fn(async (_context: WriteTransactionContext, listings: readonly ListingSnapshot[]) => listings.map((listing) => record(listing.id, listing.sku, listing.version, listing.state)));
    const service = new ListingPublication(
      repository(candidates, save),
      port(async (_context, _scope, subjects) => subjects.map((subject) => ({ listing: subject.listing, eligible: true, policyVersion: 5 }))),
      pricePort(async () => [price('sku:one'), price('sku:two')]),
      stockPort(async () => [stock('sku:one'), stock('sku:two'), stock('sku:three')])
    );

    const commands = [
      { id: 'listing:one', expectedVersion: 1 },
      { id: 'listing:two', expectedVersion: 9 },
      { id: 'listing:three', expectedVersion: 1 },
      { id: 'listing:missing', expectedVersion: 1 },
    ];
    const preview = await service.preview(context, 'mall:one', commands, 'publish');
    expect(preview.items).toEqual([
      expect.objectContaining({ id: 'listing:one', state: 'ready', version: 1 }),
      expect.objectContaining({ id: 'listing:two', state: 'failed', error: 'VERSION_CONFLICT', version: 1 }),
      expect.objectContaining({ id: 'listing:three', state: 'failed', error: 'LISTING_NOT_PURCHASABLE', gaps: ['PRICE_MISSING'] }),
      expect.objectContaining({ id: 'listing:missing', state: 'failed', error: 'RESOURCE_NOT_FOUND', version: null }),
    ]);
    expect(preview.previewHash).toMatch(/^[0-9a-f]{64}$/);
    expect(save).not.toHaveBeenCalled();

    const result = await service.execute(context, 'mall:one', commands, 'publish', preview.previewHash, 'principal:one', 'trace:partial');

    expect(result.items).toEqual([
      expect.objectContaining({ id: 'listing:one', state: 'succeeded' }),
      expect.objectContaining({ id: 'listing:two', state: 'failed', error: 'VERSION_CONFLICT' }),
      expect.objectContaining({ id: 'listing:three', state: 'failed', error: 'LISTING_NOT_PURCHASABLE', gaps: ['PRICE_MISSING'] }),
      expect.objectContaining({ id: 'listing:missing', state: 'failed', error: 'RESOURCE_NOT_FOUND' }),
    ]);
    expect(save.mock.calls[0]?.[1]).toHaveLength(1);
  });

  it('rejects execution when versions or dependency evidence no longer match the preview hash', async () => {
    const service = new ListingPublication(
      repository(
        [candidate('listing:one', 'sku:one')],
        vi.fn(async () => [])
      ),
      port(async () => [{ listing: 'listing:one', eligible: true, policyVersion: 1 }]),
      pricePort(async () => [price('sku:one')]),
      stockPort(async () => [stock('sku:one')])
    );
    await expect(service.execute(context, 'mall:one', [{ id: 'listing:one', expectedVersion: 1 }], 'publish', '0'.repeat(64), 'principal:one', 'trace:stale')).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
      details: { reason: 'BATCH_PREVIEW_CHANGED' },
    });
  });

  it('turns a lost optimistic update into a row receipt and emits no event', async () => {
    const service = new ListingPublication(
      repository(
        [candidate('listing:one', 'sku:one')],
        vi.fn(async () => [])
      ),
      port(async () => [{ listing: 'listing:one', eligible: true, policyVersion: 1 }]),
      pricePort(async () => [price('sku:one')]),
      stockPort(async () => [stock('sku:one')])
    );
    const result = await service.change(context, 'mall:one', [{ id: 'listing:one', expectedVersion: 1 }], 'publish', 'principal:one', 'trace:race');
    expect(result.items[0]).toMatchObject({ state: 'failed', error: 'VERSION_CONFLICT' });
    expect(result.events).toHaveLength(0);
  });
});

function candidate(id: string, sku: string): ListingCandidate {
  return Object.freeze({
    listing: Object.freeze({ id, scope: 'mall:one', pool: 'pool:one', sku, title: id, state: 'draft', effectiveAt: null, expiresAt: null, version: 1 }),
    product: `product:${sku}`,
    productState: 'active',
    category: 'category:food',
    partner: null,
    regions: Object.freeze([]),
    skuState: 'active',
    poolReady: true,
    scopeReady: true,
    channelReady: true,
  });
}
function repository(candidates: readonly ListingCandidate[], save: ListingRepository['save']): ListingRepository {
  return { read: async () => [], candidates: async () => candidates, save };
}
function port(decisions: CatalogQualificationPort['decisions']): CatalogQualificationPort {
  return { decisions: vi.fn(decisions) };
}
function pricePort(prices: CatalogPricingPort['prices']): CatalogPricingPort {
  return { prices: vi.fn(prices) };
}
function stockPort(stockValue: CatalogInventoryPort['stock']): CatalogInventoryPort {
  return { stock: vi.fn(stockValue) };
}
function price(sku: string) {
  return Object.freeze({ sku, amountMinor: 100, bookStatus: 'active', effectiveAt: '2020-01-01T00:00:00.000Z', expiresAt: null, bookVersion: '2', priceVersion: 2 });
}
function stock(sku: string) {
  return Object.freeze({ sku, onhand: 10, safety: 1, status: 'active', version: 3 });
}
function record(id: string, sku: string, version: number, status: string) {
  return Object.freeze({ id, scope_id: 'mall:one', pool_id: 'pool:one', sku_id: sku, title: id, status, version }) as never;
}
