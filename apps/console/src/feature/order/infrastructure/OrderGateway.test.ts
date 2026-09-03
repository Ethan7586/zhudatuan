// @vitest-environment node
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { EMPTY_ORDER_LIST_FILTER } from '../model/OrderFilter';
import { ORDER_PAGE_LIMIT, type OrderQuery } from '../model/OrderQuery';
import { orderKey } from '../viewmodel/OrderQueryKey';
import { OrderGateway } from './OrderGateway';
import { OrderPageSchema } from './OrderSchema';

const requests: URL[] = [];
const gateway = new OrderGateway('http://localhost');
const server = setupServer(
  http.get('*/api/v1/orders', ({ request }) => {
    requests.push(new URL(request.url));
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:1');
    expect(request.headers.get('x-access-version')).toBe('7');
    return HttpResponse.json({ items: [], count: 0 });
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
    await gateway.orders(context(), query({ order: 'order:internal:42', view: 'active', placed: '7days', lifecycle: 'fulfilling', payment: 'paid', fulfillment: 'processing', mall: 'mall:1', cursor: 'cursor:50' }), new AbortController().signal);
    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({
      limit: String(ORDER_PAGE_LIMIT),
      order: 'order:internal:42',
      placed: '7days',
      lifecycle: 'fulfilling',
      payment: 'paid',
      fulfillment: 'processing',
      mall: 'mall:1',
      view: 'active',
      cursor: 'cursor:50',
    });
  });

  it('isolates query keys by scope, access version, order and cursor', () => {
    const keys = [
      orderKey(context(), query({ order: 'order:1', cursor: 'cursor:1' })),
      orderKey(context('enterprise:2'), query({ order: 'order:1', cursor: 'cursor:1' })),
      orderKey(context('enterprise:1', 8), query({ order: 'order:1', cursor: 'cursor:1' })),
      orderKey(context(), query({ order: 'order:2', cursor: 'cursor:1' })),
      orderKey(context(), query({ order: 'order:1', cursor: 'cursor:2' })),
      orderKey(context(), query({ order: 'order:1', view: 'unpaid', cursor: 'cursor:1' })),
      orderKey(context(), query({ order: 'order:1', payment: 'paid', cursor: 'cursor:1' })),
    ];
    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(keys.length);
  });

  it('propagates cancellation to the SDK request', async () => {
    server.use(
      http.get('*/api/v1/orders', async () => {
        await delay('infinite');
        return HttpResponse.json({ items: [], count: 0 });
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
      http.get('*/api/v1/orders', ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({ items: [item], count: 1 });
      })
    );
    const expected = OrderPageSchema.parse({ items: [item], count: 1 }).items[0];
    const detail = await gateway.order(context(), item.id, new AbortController().signal);
    expect(detail).toEqual(expected);
    expect(Object.isFrozen(detail)).toBe(true);
    expect(Object.isFrozen(detail?.payment)).toBe(true);
    expect(Object.isFrozen(detail?.payment.tenders)).toBe(true);
    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({ order: item.id, limit: '1' });
    await expect(gateway.order(context(), item.order_number, new AbortController().signal)).resolves.toEqual(expected);
  });

  it('rejects oversized or internally inconsistent pages', () => {
    const items = Array.from({ length: ORDER_PAGE_LIMIT + 1 }, (_, index) => order(`order:${index + 1}`, `SW-${index + 1}`));
    expect(OrderPageSchema.safeParse({ items, count: items.length }).success).toBe(false);
    expect(OrderPageSchema.safeParse({ items: [order('order:1', 'SW-1')], count: 0 }).success).toBe(false);
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
    payment: { paymentId: 'payment:1', capturedMinor: 31_500, refundedMinor: 0, refundableMinor: 31_500, updatedAt: '2026-08-26T00:01:00Z', tenders: [{ sequence: 1, kind: 'wechat', referenceMasked: null, amountMinor: 31_500, state: 'captured' }] },
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
