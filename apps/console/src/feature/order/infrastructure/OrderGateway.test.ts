// @vitest-environment node
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { EMPTY_ORDER_LIST_FILTER } from '../model/OrderFilter';
import { ORDER_PAGE_LIMIT, type OrderQuery } from '../model/OrderQuery';
import { orderKey } from '../viewmodel/OrderQueryKey';
import { OrderGateway } from './OrderGateway';
import { OrderMapper } from './OrderMapper';
import { OrderPageSchema } from './OrderSchema';

const requests: URL[] = [];
const gateway = new OrderGateway('http://localhost');
const facets = {
  state: 'ready',
  data: {
    counts: { all: 0, unpaid: 0, unshipped: 0, active: 0, completed: 0, aftersale: 0, exception: 0 },
    watermarks: { order: null, payment: null, fulfillment: null, aftersale: null, refund: null },
  },
} as const;
const server = setupServer(
  http.get('*/api/v1/orders', ({ request }) => {
    requests.push(new URL(request.url));
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:1');
    expect(request.headers.get('x-access-version')).toBe('7');
    return HttpResponse.json({ items: [], count: 0, facets });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Order query', () => {
  it('sends every bounded contract filter with scope and access version', async () => {
    await gateway.orders(
      context(),
      query({ search: 'SW42', view: 'active', placed: '7days', from: '2026-08-01', to: '2026-08-31', lifecycle: 'fulfilling', payment: 'paid', fulfillment: 'processing', mall: 'mall:1', channel: 'channel:jd', product: 'sku:1', member: '王小明', minimumMinor: '100', maximumMinor: '99900', cursor: 'cursor:50' }),
      new AbortController().signal
    );
    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({
      limit: String(ORDER_PAGE_LIMIT),
      search: 'SW42',
      placed: '7days',
      from: '2026-07-31T16:00:00.000Z',
      to: '2026-08-31T15:59:59.999Z',
      lifecycle: 'fulfilling',
      payment: 'paid',
      fulfillment: 'processing',
      mall: 'mall:1',
      channel: 'channel:jd',
      product: 'sku:1',
      member: '王小明',
      minimumMinor: '100',
      maximumMinor: '99900',
      view: 'active',
      cursor: 'cursor:50',
    });
  });

  it('isolates query keys by scope, access version, order and cursor', () => {
    const keys = [
      orderKey(context(), query({ search: 'order:1', cursor: 'cursor:1' })),
      orderKey(context('enterprise:2'), query({ search: 'order:1', cursor: 'cursor:1' })),
      orderKey(context('enterprise:1', 8), query({ search: 'order:1', cursor: 'cursor:1' })),
      orderKey(context(), query({ search: 'order:2', cursor: 'cursor:1' })),
      orderKey(context(), query({ search: 'order:1', cursor: 'cursor:2' })),
      orderKey(context(), query({ search: 'order:1', view: 'unpaid', cursor: 'cursor:1' })),
      orderKey(context(), query({ search: 'order:1', payment: 'paid', cursor: 'cursor:1' })),
    ];
    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(keys.length);
  });

  it('propagates cancellation to the SDK request', async () => {
    server.use(
      http.get('*/api/v1/orders', async () => {
        await delay('infinite');
        return HttpResponse.json({ items: [], count: 0, facets });
      })
    );
    const controller = new AbortController();
    const pending = gateway.orders(context(), query(), controller.signal);
    controller.abort(new Error('SCOPE_CHANGED'));
    await expect(pending).rejects.toThrow();
  });

  it('reads detail by an exact internal id or display order number', async () => {
    const item = order('order:internal:7', 'SW-20260826-0007');
    server.use(
      http.get('*/api/v1/orders/:orderId', ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(orderDetail(item));
      })
    );
    const detail = await gateway.order(context(), item.id, new AbortController().signal);
    expect(detail).toMatchObject({ id: item.id, order_number: item.order_number, sections: { products: { state: 'ready' }, payment: { state: 'ready' } } });
    expect(Object.isFrozen(detail)).toBe(true);
    expect(Object.isFrozen(detail.payment)).toBe(true);
    expect(Object.isFrozen(detail.payment.tenders)).toBe(true);
    expect(requests[0]?.pathname).toBe(`/api/v1/orders/${encodeURIComponent(item.id)}`);
    await expect(gateway.order(context(), item.order_number, new AbortController().signal)).resolves.toMatchObject({ order_number: item.order_number });
  });

  it('loads related support cases through the generated Support SDK using an exact order filter', async () => {
    server.use(http.get('*/api/v1/support/cases', ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ items: [{ id: 'case:one', scope_id: 'enterprise:1', priority: 'high', state: 'assigned', assigned_agent_id: 'agent:one', response_due_at: '2026-09-05T02:00:00.000Z', resolution_due_at: '2026-09-05T08:00:00.000Z', created_at: '2026-09-05T01:00:00.000Z', updated_at: '2026-09-05T01:30:00.000Z', version: 1, conversation_id: 'conversation:one', skill: 'order', member_id: 'member:1', order_id: 'order:internal:7', channel: 'inapp', subject: '物流进度咨询', reference_type: null, reference_id: null, unread_count: 2, sla_risk: 'risk' }], count: 1 });
    }));
    await expect(gateway.support(context(), 'order:internal:7')).resolves.toEqual([expect.objectContaining({ id: 'case:one', subject: '物流进度咨询', unreadCount: 2 })]);
    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({ limit: '50', orderId: 'order:internal:7' });
  });

  it('reads exact payment recoveries and maps their optimistic versions', async () => {
    server.use(http.get('*/api/v1/payments/recoveries', ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ items: [{ id: 'recovery:one', order_id: 'order:internal:7', order_number: 'SW-20260826-0007', resource_type: 'intent', resource_id: 'intent:one', severity: 'critical', state: 'open', error_code: 'PAYMENT_LATE_SUCCESS', evidence: {}, occurrence_count: 2, opened_at: '2026-09-05T02:00:00.000Z', resolved_at: null, resolution_request_id: null, version: 3 }], count: 1 });
    }));
    const page = await gateway.recoveries(context(), 'order:internal:7');
    expect(page.items[0]).toMatchObject({ id: 'recovery:one', orderId: 'order:internal:7', version: 3 });
    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({ limit: '50', orderId: 'order:internal:7' });
  });

  it('cancels the exact unpaid order version and maps the immutable receipt', async () => {
    let requestBody: unknown;
    let headers: Headers | undefined;
    server.use(http.post('*/api/v1/orders/:orderId/cancel', async ({ request }) => {
      requestBody = await request.json();
      headers = request.headers;
      return HttpResponse.json({ orderId: 'order:one', lifecycleState: 'cancelled', fulfillmentState: 'cancelled', cancelledAt: '2026-09-05T02:00:00.000Z', version: 3, eventId: 'event:cancel-one', repeated: false });
    }));
    const source = { ...order('order:one', 'SW-1'), payment_state: 'unpaid' as const, fulfillment_state: 'unallocated' as const, lifecycle_state: 'awaitingpayment' as const };
    const detail = new OrderMapper().order(orderDetail(source));
    await expect(gateway.cancel(context(), detail, '收货信息有误，需要重新下单', 'cancel-key')).resolves.toMatchObject({ orderId: 'order:one', state: 'cancelled', version: 3 });
    expect(requestBody).toEqual({ expectedVersion: 2, reason: '收货信息有误，需要重新下单' });
    expect(headers?.get('if-match')).toBe('"2"');
    expect(headers?.get('idempotency-key')).toBe('cancel-key');
    expect(headers?.get('x-csrf-token')).toBe('csrf:order-test');
  });

  it('binds fulfillment, return, refund and recovery commands to exact resources and evidence headers', async () => {
    const seen: Array<{ path: string; body: unknown; match: string | null; proof: string | null; identity: string | null; csrf: string | null }> = [];
    const capture = async (request: Request) => {
      seen.push({ path: new URL(request.url).pathname, body: await request.json(), match: request.headers.get('if-match'), proof: request.headers.get('x-action-proof'), identity: request.headers.get('idempotency-key'), csrf: request.headers.get('x-csrf-token') });
    };
    const returned = (state: 'received' | 'accepted', version: number) => ({ id: 'return:one', aftersale_id: 'aftersale:one', fulfillment_id: 'fulfillment:one', scope_id: 'enterprise:1', state, provider: null, provider_reference: null, instruction: {}, tracking_number: 'SF123456', created_at: '2026-09-05T02:00:00.000Z', updated_at: '2026-09-05T03:00:00.000Z', version, lines: [{ line: 'line:one', quantity: 1 }], inspections: state === 'accepted' ? [{ id: 'inspection:one', sequence: 1, accepted: true, evidence: {}, actor: 'actor:one', inspectedAt: '2026-09-05T03:00:00.000Z' }] : [] });
    server.use(
      http.post('*/api/v1/fulfillments/:id/shipments', async ({ request }) => { await capture(request); return HttpResponse.json({ id: 'fulfillment:one', order_id: 'order:one', suborder_id: 'suborder:one', provider: null, partner_id: null, store_id: null, kind: 'shipment', route: 'physical', state: 'processing', external_reference: null, payment_id: 'payment:one', source_effect_id: null, amount_minor: 12_800, idempotency_key: null, created_at: '2026-09-05T02:00:00.000Z', updated_at: '2026-09-05T03:00:00.000Z', version: 2, shipment_id: 'shipment:one', package_id: 'package:one', tracking: 'SF123456', shipped_quantity: 1 }, { status: 201 }); }),
      http.put('*/api/v1/fulfillments/returns/:id/receipt', async ({ request }) => { await capture(request); return HttpResponse.json(returned('received', 5)); }),
      http.put('*/api/v1/fulfillments/returns/:id/inspection', async ({ request }) => { await capture(request); return HttpResponse.json(returned('accepted', 6)); }),
      http.post('*/api/v1/payments/refunds', async ({ request }) => { await capture(request); return HttpResponse.json({ id: 'refund:one', payment_id: 'payment:one', provider: 'wechat', provider_reference: 'refund-reference', amount_minor: 1000, currency: 'CNY', state: 'requested', reason: '差额退回', aftersale_id: null }, { status: 202 }); }),
      http.post('*/api/v1/payments/recoveries/:id/resolutions', async ({ request }) => { await capture(request); return HttpResponse.json({ case: 'recovery:one', request: 'recoveryrequest:one', action: 'requery', state: 'accepted' }, { status: 202 }); })
    );
    const target = { id: 'fulfillment:one', provider: null, partner: null, kind: 'shipment' as const, state: 'processing' as const, version: 1, externalReferenceMasked: null, createdAt: '2026-09-05T02:00:00.000Z', updatedAt: '2026-09-05T02:00:00.000Z', milestones: [] };
    const returnTarget = { id: 'return:one', state: 'received' as const, provider: null, providerReferenceMasked: null, trackingMasked: '尾号 3456', version: 4 };
    const detail = new OrderMapper().order(orderDetail({ ...order('order:one', 'SW-1'), payment: { ...order('order:one', 'SW-1').payment, version: 8 } }));
    const recovery = { id: 'recovery:one', orderId: 'order:one', orderNumber: 'SW-1', resourceType: 'intent', resourceId: 'intent:one', severity: 'critical' as const, state: 'open' as const, errorCode: 'PAYMENT_LATE_SUCCESS', occurrenceCount: 2, openedAt: '2026-09-05T02:00:00.000Z', resolvedAt: null, resolutionRequestId: null, version: 3 };
    const proof = 'p'.repeat(43);
    await gateway.ship(context(), target, 'SF123456', '顺丰', 'ship-key');
    await gateway.receiveReturn(context(), returnTarget, 'SF123456', 'receive-key');
    await gateway.inspectReturn(context(), returnTarget, true, '外观完整', 'inspect-key');
    await gateway.refund(context(), detail, 1000, '差额退回', proof, 'refund-key');
    await gateway.resolveRecovery(context(), recovery, 'requery', '重新核对渠道结果', proof, 'recovery-key');
    expect(seen.map(({ path }) => path)).toEqual(['/api/v1/fulfillments/fulfillment%3Aone/shipments', '/api/v1/fulfillments/returns/return%3Aone/receipt', '/api/v1/fulfillments/returns/return%3Aone/inspection', '/api/v1/payments/refunds', '/api/v1/payments/recoveries/recovery%3Aone/resolutions']);
    expect(seen.map(({ match }) => match)).toEqual(['"1"', '"4"', '"4"', '"8"', '"3"']);
    expect(seen.map(({ identity }) => identity)).toEqual(['ship-key', 'receive-key', 'inspect-key', 'refund-key', 'recovery-key']);
    expect(seen.every(({ csrf }) => csrf === 'csrf:order-test')).toBe(true);
    expect(seen.slice(0, 3).every(({ proof: value }) => value === null)).toBe(true);
    expect(seen.slice(3).every(({ proof: value }) => value === proof)).toBe(true);
    expect(seen.map(({ body }) => body)).toEqual([
      { tracking: 'SF123456', carrier: '顺丰' },
      { tracking: 'SF123456' },
      { accepted: true, inspection: { note: '外观完整' } },
      { payment: 'payment:1', amountMinor: 1000, reason: '差额退回' },
      { action: 'requery', reason: '重新核对渠道结果' },
    ]);
  });

  it('rejects oversized or internally inconsistent pages', () => {
    const items = Array.from({ length: ORDER_PAGE_LIMIT + 1 }, (_, index) => order(`order:${index + 1}`, `SW-${index + 1}`));
    expect(OrderPageSchema.safeParse({ items, count: items.length, facets }).success).toBe(false);
    expect(OrderPageSchema.safeParse({ items: [order('order:1', 'SW-1')], count: 0, facets }).success).toBe(false);
  });
});

function query(overrides: Partial<OrderQuery> = {}): OrderQuery {
  return { ...EMPTY_ORDER_LIST_FILTER, view: 'all', ...overrides };
}

function context(id = 'enterprise:1', accessVersion = 7): ConsoleContext {
  const scope = { kind: 'enterprise' as const, id };
  return {
    session: {
      actor: 'actor:1',
      membership: 'membership:1',
      accessVersion,
      permissions: [],
      capabilities: [],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 1 },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      csrf: 'csrf:order-test',
      syncedAt: '2026-08-26T00:00:00Z',
    },
    profile: { display_name: '测试运营', employee_no: null },
    scope,
    scopes: [scope],
  };
}

function order(id: string, orderNumber: string) {
  return {
    id,
    order_number: orderNumber,
    scope_id: 'enterprise:1',
    member_id: 'member:1',
    mall_id: 'mall:1',
    checkout_id: 'checkout:1',
    total_minor: 31_500,
    currency: 'CNY',
    payment_state: 'paid',
    fulfillment_state: 'allocated',
    aftersale_state: 'none',
    lifecycle_state: 'paid',
    address: null,
    payment: {
      paymentId: 'payment:1',
      version: 0,
      capturedMinor: 31_500,
      refundedMinor: 0,
      refundableMinor: 31_500,
      updatedAt: '2026-08-26T00:01:00Z',
      tenders: [{ sequence: 1, kind: 'wechat', referenceMasked: null, amountMinor: 31_500, state: 'captured' }],
    },
    fulfillments: [],
    refunds: [],
    timeline: [],
    receivedAt: null,
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:01:00Z',
    version: 2,
    lines: [],
  };
}

function orderDetail(item: ReturnType<typeof order>) {
  return {
    summary: {
      id: item.id,
      orderNumber: item.order_number,
      scopeId: item.scope_id,
      mallId: item.mall_id,
      currency: item.currency,
      totalMinor: item.total_minor,
      paymentState: item.payment_state,
      fulfillmentState: item.fulfillment_state,
      aftersaleState: item.aftersale_state,
      lifecycleState: item.lifecycle_state,
      sourceChannel: null,
      externalOrderNo: null,
      sourceState: null,
      verificationState: 'verified',
      orderedAt: item.created_at,
      address: item.address,
      receivedAt: item.receivedAt,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      version: item.version,
    },
    products: { state: 'ready', data: item.lines },
    payment: { state: 'ready', data: item.payment },
    fulfillment: { state: 'ready', data: item.fulfillments },
    aftersale: { state: 'ready', data: { state: item.aftersale_state, refunds: item.refunds } },
    finance: { state: 'ready', data: { grossMinor: item.total_minor, capturedMinor: item.payment.capturedMinor, refundedMinor: item.payment.refundedMinor, netMinor: item.payment.capturedMinor - item.payment.refundedMinor, outstandingMinor: 0, currency: item.currency, state: 'balanced', verificationState: 'verified', watermark: item.updated_at } },
    audit: { state: 'ready', data: item.timeline },
  };
}
