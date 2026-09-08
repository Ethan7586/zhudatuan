import { OPERATION_SCHEMAS } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import type { CatalogPriceCommandPort } from '../../../pricing/public';
import type { ListingPriceRepository } from '../port/ListingRepository';
import { ListingsPriceSetHandler } from './ListingsPriceSetHandler';

describe('ListingsPriceSetHandler', () => {
  it('resolves the authorized listing and writes a versioned base price', async () => {
    const priceTarget = vi.fn<ListingPriceRepository['priceTarget']>(async () => ({ listing: 'listing:one', sku: 'sku:one', scope: 'mall:one' }));
    const setPrice = vi.fn<CatalogPriceCommandPort['setPrice']>(async () => ({
      sku: 'sku:one',
      scope: 'mall:one',
      amountMinor: 9900,
      currency: 'CNY',
      version: 5,
      effectiveAt: '2026-09-07T08:00:00.000Z',
      updatedAt: '2026-09-07T08:00:00.000Z',
    }));
    const transaction = {} as never;
    const context = { ...readHandlerContext('catalog.listings.price.set', transaction), expectedVersion: 4 } as WriteHandlerContext<'catalog.listings.price.set'>;
    const reply = await new ListingsPriceSetHandler({ priceTarget }, { setPrice }).execute({ path: { listingid: 'listing:one' }, body: { amountMinor: 9900, currency: 'CNY' } }, context);

    expect(priceTarget).toHaveBeenCalledWith(transaction, 'listing:one', 'mall:one');
    expect(setPrice).toHaveBeenCalledWith(transaction, { scope: 'mall:one', sku: 'sku:one', amountMinor: 9900, currency: 'CNY', expectedVersion: 4 });
    expect(OPERATION_SCHEMAS['catalog.listings.price.set'].output.parse(reply.body)).toEqual(reply.body);
  });
});
