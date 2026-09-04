import { describe, expect, it } from 'vitest';
import { OrderDetailReadHandler } from './OrderDetailReadHandler';

describe('OrderDetailReadHandler', () => {
  it('keeps the detail usable when one projection fails and hides forbidden sections', async () => {
    const handler = new OrderDetailReadHandler(
      {
        summary: async () => summary(),
        products: async () => { throw new Error('PRODUCT_PROJECTION_DOWN'); },
        payment: async () => ({ paymentId: null, capturedMinor: 0, refundedMinor: 0, refundableMinor: 0, updatedAt: null, tenders: [] }),
        fulfillment: async () => [],
        aftersale: async () => ({ state: 'none', refunds: [] }),
        finance: async () => finance(),
      },
      { records: async () => { throw new Error('AUDIT_PROJECTION_DOWN'); } }
    );
    const result = await handler.execute({ path: { orderid: 'order:one' }, query: {} }, context('owner'));
    expect(result.body.products).toMatchObject({ state: 'unavailable', error: { code: 'ORDER_DETAIL_SECTION_UNAVAILABLE', retryable: true } });
    expect(result.body.payment.state).toBe('ready');
    expect(result.body.audit.state).toBe('hidden');
  });

  it('turns an operator audit failure into a local section error', async () => {
    const handler = new OrderDetailReadHandler(
      { summary: async () => summary(), products: async () => [], payment: async () => ({}), fulfillment: async () => [], aftersale: async () => ({}), finance: async () => finance() },
      { records: async () => { throw new Error('AUDIT_PROJECTION_DOWN'); } }
    );
    const result = await handler.execute({ path: { orderid: 'order:one' }, query: {} }, context('enterprise'));
    expect(result.body.audit).toMatchObject({ state: 'unavailable', error: { retryable: true } });
    expect(result.body.finance.state).toBe('ready');
  });

  it('isolates a financial projection failure and returns its request trace', async () => {
    const handler = new OrderDetailReadHandler(
      { summary: async () => summary(), products: async () => [], payment: async () => ({}), fulfillment: async () => [], aftersale: async () => ({}), finance: async () => { throw new Error('FINANCE_PROJECTION_DOWN'); } },
      { records: async () => [] }
    );
    const result = await handler.execute({ path: { orderid: 'order:one' }, query: {} }, context('enterprise'));
    expect(result.body.finance).toMatchObject({ state: 'unavailable', error: { traceId: 'trace:one', retryable: true } });
    expect(result.body.products.state).toBe('ready');
  });
});

function summary() {
  return { id: 'order:one', orderNumber: 'ZD202609050001', scopeId: 'mall:one', mallId: 'mall:one', currency: 'CNY', totalMinor: 100,
    paymentState: 'unpaid', fulfillmentState: 'unallocated', aftersaleState: 'none', lifecycleState: 'awaitingpayment',
    sourceChannel: null, externalOrderNo: null, sourceState: null, verificationState: 'verified' as const, orderedAt: new Date('2026-09-04T08:00:00.000Z'), address: null,
    receivedAt: null, createdAt: new Date('2026-09-05T00:00:00.000Z'), updatedAt: new Date('2026-09-05T00:00:00.000Z'), version: 0 };
}

function finance() {
  return { grossMinor: 100, capturedMinor: 100, refundedMinor: 0, netMinor: 100, outstandingMinor: 0, currency: 'CNY', state: 'balanced' as const, verificationState: 'verified' as const, watermark: new Date('2026-09-05T00:00:00.000Z') };
}

function context(kind: 'owner' | 'enterprise') {
  return {
    transaction: {}, signal: new AbortController().signal, traceId: 'trace:one',
    security: { kind: 'session', access: { actor: { id: 'principal:one' }, membership: { id: 'membership:one' }, scope: { id: kind === 'owner' ? 'member:one' : 'enterprise:one', kind, path: [] }, organization: 'mall:one', trace: 'trace:one' } },
  } as never;
}
