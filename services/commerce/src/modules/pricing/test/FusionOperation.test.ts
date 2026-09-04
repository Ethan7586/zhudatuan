import { OPERATION_SCHEMAS } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { readHandlerContext } from '../../../test/HandlerFixture';
import { withReadTransaction, result } from '../../../test/TransactionFixture';
import { OffersReadHandler } from '../application/handler/OffersReadHandler';
import { PgPricingReadPort } from '../infrastructure/persistence/PgPricingReadPort';
import type { PricingReadPort } from '../public/PricingReadPort';

describe('pricing offers read', () => {
  it('deduplicates SKU selectors and returns the effective breakdown with the latest watermark', async () => {
    const transaction = {} as ReadTransactionContext;
    const offers = vi.fn(async () => [
      {
        sku: 'sku:one',
        scope: 'mall:one',
        amountMinor: 8800,
        compareMinor: 10000,
        currency: 'CNY',
        sourceVersion: 1,
        breakdown: [
          { kind: 'base' as const, label: '基础价', amountMinor: 10000 },
          { kind: 'discount' as const, label: '优惠', amountMinor: -1200 },
        ],
        status: 'effective' as const,
        effectiveAt: '2026-09-04T08:00:00.000Z',
        expiresAt: null,
        version: 'price:one',
        watermark: '2026-09-04T08:00:00.000Z',
      },
    ]);
    const pricing: PricingReadPort = { prices: async () => [], offers };
    const reply = await new OffersReadHandler(pricing).execute({ query: { sku: ['sku:one', 'sku:one'] } } as never, readHandlerContext('pricing.offers.read', transaction));
    expect(offers).toHaveBeenCalledExactlyOnceWith(transaction, 'mall:one', ['sku:one']);
    expect(OPERATION_SCHEMAS['pricing.offers.read'].output.parse(reply.body)).toEqual(reply.body);
    expect(reply.body).toMatchObject({ count: 1, watermark: '2026-09-04T08:00:00.000Z', items: [{ amountMinor: 8800 }] });
  });

  it('projects the active price and an additive breakdown from persistence', async () => {
    const projected = await withReadTransaction(
      async (text, values) => {
        if (text.includes('from pricing.rule')) return result([]);
        expect(text).toContain("book.status='active'");
        expect(values).toEqual([['mall:one'], ['sku:one']]);
        return result([
          {
            id: 'price:one',
            book_id: 'pricebook:one',
            sku: 'sku:one',
            scope: 'mall:one',
            amount_minor: 8800,
            compare_minor: 10000,
            currency: 'CNY',
            version: 1,
            book_version: 2,
            book_name: '商城价格簿',
            book_status: 'active',
            effective_at: new Date('2026-09-04T08:00:00.000Z'),
            expires_at: null,
            updated_at: new Date('2026-09-04T08:00:00.000Z'),
          },
        ]);
      },
      (context) => new PgPricingReadPort().offers(context, 'mall:one', ['sku:one'])
    );
    expect(projected[0]?.breakdown.reduce((total, item) => total + item.amountMinor, 0)).toBe(8800);
    expect(projected[0]).toMatchObject({ status: 'effective', watermark: '2026-09-04T08:00:00.000Z' });
  });
});
