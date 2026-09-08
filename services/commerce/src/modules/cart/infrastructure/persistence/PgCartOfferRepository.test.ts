import { describe, expect, it, vi } from 'vitest';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgCartOfferRepository } from './PgCartOfferRepository';

const context = { deadline: Date.now() + 60_000, signal: new AbortController().signal } as ReadTransactionContext;

describe('PgCartOfferRepository', () => {
  it('reads price and inventory owners on every projection instead of freezing a cart quote', async () => {
    const inspect = vi.fn(async () => new Map([['listing:1', { listing: 'listing:1', sku: 'sku:1', title: '商品', version: 3, benefitApplicable: true, code: 'valid' as const }]]));
    const currentMany = vi
      .fn()
      .mockResolvedValueOnce(new Map([['sku:1', { amountMinor: 100, currency: 'CNY', version: 'price:1' }]]))
      .mockResolvedValueOnce(new Map([['sku:1', { amountMinor: 130, currency: 'CNY', version: 'price:2' }]]));
    const availability = vi.fn(async () => [{ sku: 'sku:1', available: 9, state: 'available' as const, version: 'stock:1' }]);
    const repository = new PgCartOfferRepository({ inspect } as never, { currentMany } as never, { availability } as never);
    await expect(repository.resolve(context, 'mall:1', [{ listing: 'listing:1', sku: 'sku:1' }])).resolves.toEqual(new Map([['listing:1', expect.objectContaining({ amountMinor: 100, priceVersion: 'price:1' })]]));
    await expect(repository.resolve(context, 'mall:1', [{ listing: 'listing:1', sku: 'sku:1' }])).resolves.toEqual(new Map([['listing:1', expect.objectContaining({ amountMinor: 130, priceVersion: 'price:2' })]]));
  });

  it('keeps an out-of-scope listing explainable without querying a second quote truth', async () => {
    const inspect = vi.fn(async () => new Map([['listing:1', { listing: 'listing:1', sku: 'sku:1', title: '商品', version: 3, benefitApplicable: false, code: 'outofscope' as const }]]));
    const repository = new PgCartOfferRepository({ inspect } as never, { currentMany: vi.fn(async () => new Map()) } as never, { availability: vi.fn(async () => []) } as never);
    await expect(repository.resolve(context, 'mall:other', [{ listing: 'listing:1', sku: 'sku:1' }])).resolves.toEqual(new Map([['listing:1', expect.objectContaining({ code: 'outofscope', amountMinor: null })]]));
  });
});
