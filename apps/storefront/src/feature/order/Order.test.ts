import { describe, expect, it } from 'vitest';
import { mapOrder, mapTimeline } from './infrastructure/OrderMapper';
import { fulfillmentStateText, orderStatusText, paymentStateText, timelineStateText } from './model/OrderText';

describe('order model mapping', () => {
  it('preserves integer money, version and immutable order lines', () => {
    const order = mapOrder(
      {
        id: 'order:one',
        order_number: '202608310001',
        mall_id: 'mall:one',
        lifecycle_state: 'shipped',
        payment_state: 'captured',
        fulfillment_state: 'shipped',
        aftersale_state: 'none',
        currency: 'CNY',
        total_minor: 129900,
        version: 4,
        created_at: '2026-08-31T01:00:00.000Z',
        updated_at: '2026-08-31T02:00:00.000Z',
        lines: [
          {
            id: 'line:one',
            listing: 'listing:one',
            sku: 'sku:one',
            title: '福利商品',
            unitMinor: 129900,
            totalMinor: 129900,
            discountMinor: 0,
            payableMinor: 129900,
            quantity: 1,
            productType: 'voucher',
            category: 'category:voucher',
            provider: 'supplier',
            partner: 'partner:one',
          },
        ],
      } as never,
      mall()
    );
    expect(order).toMatchObject({ status: 'pending_receipt', totalMinor: 129900, version: 4 });
    expect(order.lines[0]).toMatchObject({ unitMinor: 129900, quantity: 1, itemType: 'virtual_coupon', categoryId: 'category:voucher' });
    expect(Object.isFrozen(order.lines)).toBe(true);
  });

  it('flattens provider milestones into the order timeline', () => {
    const timeline = mapTimeline({ items: [{ milestones: [{ id: 'milestone:one', kind: 'shipping', state: 'intransit', tracking: 'SF123', occurredAt: '2026-08-31T02:00:00.000Z', evidence: { city: '上海' } }] }] } as never);
    expect(timeline).toEqual([{ id: 'milestone:one', kind: 'shipping', state: 'intransit', tracking: 'SF123', occurredAt: '2026-08-31T02:00:00.000Z', evidence: { city: '上海' } }]);
  });

  it('presents every internal order state as clear Chinese copy', () => {
    expect(orderStatusText('pending_payment')).toBe('待付款');
    expect(paymentStateText('unpaid')).toBe('待付款');
    expect(fulfillmentStateText('unallocated')).toBe('待分配履约方');
    expect(timelineStateText('intransit')).toBe('运输途中');
    expect(fulfillmentStateText('futurestate')).toBe('履约处理中');
  });
});

function mall() {
  return { id: 'mall:one', enterpriseId: 'enterprise:one', enterpriseName: '智慧翼', mallName: '员工福利商城', logoText: '智慧翼', badge: '', welcomeBanner: '' };
}
