import { describe, expect, it } from 'vitest';
import { OrderDetailReadHandler } from './OrderDetailReadHandler';
import { OrderLabels } from '../service/OrderLabels';

describe('OrderDetailReadHandler', () => {
  it('keeps the detail usable when one projection fails and hides forbidden sections', async () => {
    const handler = new OrderDetailReadHandler(
      {
        summary: async () => summary(),
        products: async () => {
          throw new Error('PRODUCT_PROJECTION_DOWN');
        },
        payment: async () => ({ paymentId: null, capturedMinor: 0, refundedMinor: 0, refundableMinor: 0, updatedAt: null, tenders: [] }),
        fulfillment: async () => [],
        aftersale: async () => ({ state: 'none', refunds: [] }),
        finance: async () => finance(),
      },
      {
        records: async () => {
          throw new Error('AUDIT_PROJECTION_DOWN');
        },
      },
      labels()
    );
    const result = await handler.execute({ path: { orderid: 'order:one' }, query: {} }, context('owner'));
    expect(result.body.products).toMatchObject({ state: 'unavailable', error: { code: 'ORDER_DETAIL_SECTION_UNAVAILABLE', retryable: true } });
    expect(result.body.payment.state).toBe('ready');
    expect(result.body.audit.state).toBe('hidden');
  });

  it('turns an operator audit failure into a local section error', async () => {
    const handler = new OrderDetailReadHandler(
      { summary: async () => summary(), products: async () => [], payment: async () => ({}), fulfillment: async () => [], aftersale: async () => ({}), finance: async () => finance() },
      {
        records: async () => {
          throw new Error('AUDIT_PROJECTION_DOWN');
        },
      },
      labels()
    );
    const result = await handler.execute({ path: { orderid: 'order:one' }, query: {} }, context('enterprise'));
    expect(result.body.audit).toMatchObject({ state: 'unavailable', error: { retryable: true } });
    expect(result.body.finance.state).toBe('ready');
  });

  it('isolates a financial projection failure and returns its request trace', async () => {
    const handler = new OrderDetailReadHandler(
      {
        summary: async () => summary(),
        products: async () => [],
        payment: async () => ({}),
        fulfillment: async () => [],
        aftersale: async () => ({}),
        finance: async () => {
          throw new Error('FINANCE_PROJECTION_DOWN');
        },
      },
      { records: async () => [] },
      labels()
    );
    const result = await handler.execute({ path: { orderid: 'order:one' }, query: {} }, context('enterprise'));
    expect(result.body.finance).toMatchObject({ state: 'unavailable', error: { traceId: 'trace:one', retryable: true } });
    expect(result.body.products.state).toBe('ready');
  });

  it('projects readable member, organization, partner and actor names without exposing identifiers as labels', async () => {
    const handler = new OrderDetailReadHandler(
      {
        summary: async () => ({ ...summary(), scopeId: 'enterprise:one' }),
        products: async () => [{ id: 'line:one', partner: 'partner:one' }],
        payment: async () => ({}),
        fulfillment: async () => [{ id: 'fulfillment:one', partner: 'partner:one' }],
        aftersale: async () => ({}),
        finance: async () => finance(),
      },
      {
        records: async () => [
          {
            id: 'audit:one',
            kind: 'command',
            operation: 'order.receive',
            subject: { type: 'order', id: 'order:one' },
            object: { type: 'order', id: 'order:one' },
            actor: { type: 'principal', id: 'principal:one' },
            request: 'request:one',
            outcome: 'succeeded',
            reason: 'accepted',
            beforeHash: null,
            afterHash: null,
            previousHash: null,
            recordHash: 'hash:one',
            evidence: {},
            occurredAt: '2026-09-05T00:00:00.000Z',
            trace: 'trace:one',
          },
        ],
      },
      new OrderLabels(
        {
          profiles: async () => [{ member: 'member:one', displayName: '王小明', mobileMasked: '138****0000' }],
          principals: async () => [{ principal: 'principal:one', displayName: '李运营', mobileMasked: null }],
        },
        {
          summaries: async () => [
            { id: 'enterprise:one', name: '示例集团', kind: 'enterprise' },
            { id: 'mall:one', name: '员工福利商城', kind: 'mall' },
          ],
        },
        { names: async () => new Map([['partner:one', '品质供应商']]) }
      )
    );

    const result = await handler.execute({ path: { orderid: 'order:one' }, query: {} }, context('enterprise'));

    expect(result.body.summary).toMatchObject({ memberName: '王小明', scopeName: '示例集团', mallName: '员工福利商城' });
    expect(result.body.products).toMatchObject({ state: 'ready', data: [{ partnerName: '品质供应商' }] });
    expect(result.body.fulfillment).toMatchObject({ state: 'ready', data: [{ partnerName: '品质供应商' }] });
    expect(result.body.audit).toMatchObject({ state: 'ready', data: [{ actorName: '李运营' }] });
  });
});

function summary() {
  return {
    id: 'order:one',
    orderNumber: 'ZD202609050001',
    memberId: 'member:one',
    scopeId: 'mall:one',
    mallId: 'mall:one',
    currency: 'CNY',
    totalMinor: 100,
    paymentState: 'unpaid',
    fulfillmentState: 'unallocated',
    aftersaleState: 'none',
    lifecycleState: 'awaitingpayment',
    sourceChannel: null,
    externalOrderNo: null,
    sourceState: null,
    verificationState: 'verified' as const,
    orderedAt: new Date('2026-09-04T08:00:00.000Z'),
    address: null,
    receivedAt: null,
    createdAt: new Date('2026-09-05T00:00:00.000Z'),
    updatedAt: new Date('2026-09-05T00:00:00.000Z'),
    version: 0,
  };
}

function finance() {
  return { grossMinor: 100, capturedMinor: 100, refundedMinor: 0, netMinor: 100, outstandingMinor: 0, currency: 'CNY', state: 'balanced' as const, verificationState: 'verified' as const, watermark: new Date('2026-09-05T00:00:00.000Z') };
}

function context(kind: 'owner' | 'enterprise') {
  return {
    transaction: {},
    signal: new AbortController().signal,
    traceId: 'trace:one',
    security: {
      kind: 'session',
      access: { actor: { id: 'principal:one' }, membership: { id: 'membership:one' }, scope: { id: kind === 'owner' ? 'member:one' : 'enterprise:one', kind, path: [] }, organization: 'mall:one', trace: 'trace:one' },
    },
  } as never;
}

function labels() {
  return new OrderLabels({ profiles: async () => [], principals: async () => [] }, { summaries: async () => [] }, { names: async () => new Map() });
}
