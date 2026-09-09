import { describe, expect, it } from 'vitest';
import { mapOrder, mapOrderDetail, mapTimeline } from './infrastructure/OrderMapper';
import { fulfillmentStateText, orderStatusText, paymentStateText, timelineStateText } from './model/OrderText';

describe('order model mapping', () => {
  it('preserves integer money, version and immutable order lines', () => {
    const order = mapOrder({
      id: 'order:one',
      order_number: '202608310001',
      scope_id: 'enterprise:authority',
      scope_name: '智慧翼集团',
      mall_id: 'mall:one',
      mall_name: '智慧翼员工商城',
      lifecycle_state: 'shipped',
      payment_state: 'paid',
      fulfillment_state: 'shipped',
      aftersale_state: 'none',
      currency: 'CNY',
      total_minor: 129900,
      payment: { paymentId: 'payment:one', version: 0, capturedMinor: 129900, refundedMinor: 0, refundableMinor: 129900, updatedAt: '2026-08-31T02:00:00.000Z', tenders: [] },
      fulfillments: [],
      refunds: [],
      timeline: [],
      receivedAt: null,
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
          partnerName: '员工福利供应商',
        },
      ],
    } as never);
    expect(order).toMatchObject({ status: 'pending_receipt', totalMinor: 129900, version: 4, enterpriseName: '智慧翼集团', mallName: '智慧翼员工商城' });
    expect(order.lines[0]).toMatchObject({ unitMinor: 129900, quantity: 1, itemType: 'virtual_coupon', categoryId: 'category:voucher', partnerName: '员工福利供应商' });
    expect(Object.isFrozen(order.lines)).toBe(true);
  });

  it('flattens provider milestones into the order timeline', () => {
    const timeline = mapTimeline({ items: [{ shipments: [{ packages: [{ tracking: 'SF123', events: [{ id: 'milestone:one', state: 'intransit', occurredAt: '2026-08-31T02:00:00.000Z', evidence: { city: '上海' } }] }] }] }] } as never);
    expect(timeline).toEqual([{ id: 'milestone:one', kind: 'tracking', state: 'intransit', tracking: 'SF123', occurredAt: '2026-08-31T02:00:00.000Z', evidence: { city: '上海' } }]);
  });

  it('presents every internal order state as clear Chinese copy', () => {
    expect(orderStatusText('pending_payment')).toBe('待付款');
    expect(paymentStateText('unpaid')).toBe('待付款');
    expect(paymentStateText('paid')).toBe('已付款');
    expect(paymentStateText('partially_refunded')).toBe('部分退款');
    expect(fulfillmentStateText('unallocated')).toBe('待分配履约方');
    expect(timelineStateText('intransit')).toBe('运输途中');
    expect(fulfillmentStateText('futurestate')).toBe('履约处理中');
  });

  it('maps sectioned order detail without letting a delayed projection hide ready facts', () => {
    const order = mapOrderDetail({
      summary: {
        id: 'order:one',
        orderNumber: 'SW202609050001',
        memberId: 'member:one',
        memberName: '王小明',
        scopeId: 'owner:one',
        scopeName: '王小明',
        mallId: 'mall:one',
        mallName: '员工福利商城',
        currency: 'CNY',
        totalMinor: 8800,
        paymentState: 'paid',
        fulfillmentState: 'shipped',
        aftersaleState: 'none',
        lifecycleState: 'shipped',
        sourceChannel: null,
        externalOrderNo: null,
        sourceState: null,
        verificationState: 'verified',
        orderedAt: '2026-09-05T01:00:00.000Z',
        address: { recipientMasked: '王**', mobileMasked: '138****0000', addressMasked: '上海市****路', regionCode: '310000' },
        receivedAt: null,
        createdAt: '2026-09-05T01:00:00.000Z',
        updatedAt: '2026-09-05T02:00:00.000Z',
        version: 3,
      },
      products: {
        state: 'ready',
        data: [
          {
            id: 'line:one',
            sku: 'sku:one',
            listing: 'listing:one',
            title: '员工礼品',
            quantity: 1,
            unitMinor: 8800,
            totalMinor: 8800,
            discountMinor: 0,
            payableMinor: 8800,
            productType: 'physical',
            category: 'category:gift',
            provider: null,
            partner: null,
            partnerName: null,
          },
        ],
      },
      payment: { state: 'unavailable', error: { code: 'PAYMENT_DELAYED', message: '支付投影正在追赶', retryable: true, traceId: 'trace:payment-1' } },
      fulfillment: {
        state: 'ready',
        data: [
          {
            id: 'fulfillment:one',
            provider: null,
            partner: null,
            partnerName: null,
            kind: 'shipment',
            state: 'processing',
            externalReferenceMasked: null,
            createdAt: '2026-09-05T01:10:00.000Z',
            updatedAt: '2026-09-05T02:00:00.000Z',
            milestones: [{ id: 'milestone:one', kind: 'shipping', state: 'intransit', trackingMasked: 'SF****0001', occurredAt: '2026-09-05T02:00:00.000Z' }],
          },
        ],
      },
      aftersale: { state: 'hidden' },
      finance: { state: 'hidden' },
      audit: { state: 'hidden' },
    } as never);
    expect(order).toMatchObject({ enterpriseName: '王小明', mallName: '员工福利商城' });
    expect(order.lines[0]?.title).toBe('员工礼品');
    expect(order.timeline[0]?.tracking).toBe('SF****0001');
    expect(order.sections.payment).toEqual({ state: 'unavailable', message: '支付投影正在追赶', retryable: true });
    expect(order.payment).toBeNull();
    expect(order.sections.aftersale).toEqual({ state: 'hidden' });
    expect(Object.isFrozen(order.sections)).toBe(true);
  });
});
