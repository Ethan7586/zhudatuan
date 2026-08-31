import { describe, expect, it } from 'vitest';
import type { OperationOutputFor } from '@shop/contract';
import { mapAfterSalePage } from './infrastructure/AfterSaleMapper';

describe('AfterSale feature', () => {
  it('maps eligibility, refund split and immutable timeline without losing unavailable reasons', () => {
    const value: OperationOutputFor<'order.aftersales.read'> = {
      items: [
        {
          id: 'aftersale:one',
          orderId: 'order:one',
          state: 'returning',
          reasonCode: 'quality',
          description: '外包装破损且商品受损',
          currency: 'CNY',
          expectedRefundMinor: 12_300,
          expectedRefund: { totalMinor: 12_300, currency: 'CNY', tenders: [{ kind: 'benefit', reference: 'account:one', amountMinor: 12_300 }] },
          requiresReturn: true,
          unavailableReason: null,
          requestedBy: 'principal:one',
          createdAt: '2026-08-31T00:00:00.000Z',
          updatedAt: '2026-08-31T00:01:00.000Z',
          version: 3,
          lines: [
            {
              lineId: 'line:one',
              skuId: 'sku:one',
              listingId: 'listing:one',
              title: '福利商品',
              productType: 'physical',
              provider: 'jdproduct',
              purchasedQuantity: 2,
              fulfilledQuantity: 2,
              claimedQuantity: 0,
              requestedQuantity: 1,
              maximumQuantity: 2,
              unitMinor: 12_300,
              refundMinor: 12_300,
              available: true,
              unavailableReason: null,
            },
          ],
          attachments: [{ objectId: 'object:one', name: 'damage.png', mediaType: 'image/png', sizeBytes: 1024, contentHash: 'a'.repeat(64) }],
          timeline: [
            { sequence: 1, kind: 'application', previousState: null, state: 'applied', evidence: {}, occurredAt: '2026-08-31T00:00:00.000Z' },
            {
              sequence: 2,
              kind: 'returnauthorized',
              previousState: 'approved',
              state: 'returning',
              evidence: { returns: [{ id: 'return:one', state: 'authorized', provider: 'jdproduct', providerReference: 'JD-R-1', trackingNumber: null, instruction: { address: '北京市退货中心' } }] },
              occurredAt: '2026-08-31T00:01:00.000Z',
            },
          ],
        },
      ],
      count: 1,
      availableLines: [
        {
          lineId: 'line:one',
          skuId: 'sku:one',
          listingId: 'listing:one',
          title: '福利商品',
          productType: 'physical',
          provider: 'jdproduct',
          purchasedQuantity: 2,
          fulfilledQuantity: 2,
          claimedQuantity: 1,
          maximumQuantity: 1,
          expectedRefundMinor: 12_300,
          available: false,
          unavailableReason: 'AFTERSALE_WINDOW_EXPIRED',
          deadline: '2026-08-30T00:00:00.000Z',
          requiresReturn: true,
        },
      ],
    };
    const page = mapAfterSalePage(value);
    expect(page.items[0]).toMatchObject({ state: 'returning', expectedRefundMinor: 12_300, requiresReturn: true });
    expect(page.items[0]?.timeline.map(({ state }) => state)).toEqual(['applied', 'returning']);
    expect(page.items[0]?.returns[0]).toMatchObject({ id: 'return:one', providerReference: 'JD-R-1' });
    expect(page.availableLines[0]).toMatchObject({ available: false, unavailableReason: 'AFTERSALE_WINDOW_EXPIRED' });
  });
});
