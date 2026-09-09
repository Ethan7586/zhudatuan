// @vitest-environment node
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { readOrderDetail } from './OrderDetailQuery';
import { ORDER_PAGE_LIMIT, orderKey, readOrders, type OrderQuery } from './OrderQuery';
import { OrderPageSchema, type OrderRecord } from './OrderSchema';

interface CapturedRequest {
  readonly url: URL;
  readonly scope: string | null;
  readonly accessVersion: string | null;
}

const requests: CapturedRequest[] = [];
const emptyPage = { items: [], count: 0 };
const server = setupServer(
  http.get('*/api/v1/orders', ({ request }) => {
    requests.push({
      url: new URL(request.url),
      scope: request.headers.get('x-scope-hint'),
      accessVersion: request.headers.get('x-access-version'),
    });
    return HttpResponse.json(emptyPage);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Order list query', () => {
  it('sends the bounded typed query with exact internal order id, cursor, scope and access version', async () => {
    const context = createContext('enterprise', 'enterprise:1', 7);
    await readOrders(context, { order: 'order:internal:42', cursor: 'cursor:50' }, new AbortController().signal);

    expect(requests).toHaveLength(1);
    const request = requests[0];
    expect(request?.url.pathname).toBe('/api/v1/orders');
    expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
      limit: String(ORDER_PAGE_LIMIT),
      order: 'order:internal:42',
      cursor: 'cursor:50',
    });
    expect(request?.scope).toBe('enterprise:1');
    expect(request?.accessVersion).toBe('7');
  });

  it('isolates query keys by scope, access version, every filter and cursor', () => {
    const baseline: OrderQuery = {
      order: 'order:1',
      placed: 'today',
      lifecycle: 'active',
      payment: 'paid',
      fulfillment: 'allocated',
      mall: 'mall:1',
      view: 'active',
      cursor: 'cursor:1',
    };
    const baselineContext = createContext('enterprise', 'enterprise:1', 7);
    const keys = [
      orderKey(baselineContext, baseline),
      orderKey(createContext('mall', 'mall:2', 7), baseline),
      orderKey(createContext('enterprise', 'enterprise:1', 8), baseline),
      orderKey(baselineContext, { ...baseline, order: 'order:2' }),
      orderKey(baselineContext, { ...baseline, placed: '7days' }),
      orderKey(baselineContext, { ...baseline, lifecycle: 'completed' }),
      orderKey(baselineContext, { ...baseline, payment: 'refunded' }),
      orderKey(baselineContext, { ...baseline, fulfillment: 'delivered' }),
      orderKey(baselineContext, { ...baseline, mall: 'mall:2' }),
      orderKey(baselineContext, { ...baseline, view: 'completed' }),
      orderKey(baselineContext, { ...baseline, cursor: 'cursor:2' }),
    ];

    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(keys.length);
    expect(keys[0]).toContain(ORDER_PAGE_LIMIT);
  });

  it('sends authoritative server filters to production scopes', async () => {
    const filter: OrderQuery = {
      order: '',
      placed: '30days',
      lifecycle: 'completed',
      payment: 'refunded',
      fulfillment: 'returned',
      mall: 'mall:east',
      view: 'exception',
      cursor: 'cursor:production',
    };

    await readOrders(createContext('enterprise', 'enterprise:1', 7), filter, new AbortController().signal);

    expect(Object.fromEntries(requests[0]?.url.searchParams ?? [])).toEqual({
      limit: String(ORDER_PAGE_LIMIT),
      cursor: 'cursor:production',
      placed: '30days',
      lifecycle: 'completed',
      payment: 'refunded',
      fulfillment: 'returned',
      mall: 'mall:east',
      view: 'exception',
    });
  });

  it('sends supported demo filters only for the isolated local preview scope', async () => {
    const filter: OrderQuery = {
      order: 'order:preview:1',
      placed: '7days',
      lifecycle: 'active',
      payment: 'paid',
      fulfillment: 'shipped',
      mall: 'mall:preview',
      view: 'unshipped',
      cursor: 'cursor:preview',
    };

    await readOrders(createContext('platform', 'platform:preview', 11), filter, new AbortController().signal);

    expect(Object.fromEntries(requests[0]?.url.searchParams ?? [])).toEqual({
      limit: String(ORDER_PAGE_LIMIT),
      order: 'order:preview:1',
      cursor: 'cursor:preview',
      placed: '7days',
      lifecycle: 'active',
      payment: 'paid',
      fulfillment: 'shipped',
      mall: 'mall:preview',
      view: 'unshipped',
    });
    expect(requests[0]?.scope).toBe('platform:preview');
    expect(requests[0]?.accessVersion).toBe('11');
  });

  it('propagates cancellation to the SDK request', async () => {
    server.use(
      http.get('*/api/v1/orders', async () => {
        await delay('infinite');
        return HttpResponse.json(emptyPage);
      })
    );
    const controller = new AbortController();
    const pending = readOrders(createContext('enterprise', 'enterprise:1', 7), { order: '' }, controller.signal);

    controller.abort(new Error('SCOPE_CHANGED'));

    await expect(pending).rejects.toThrow();
  });
});

describe('Order detail query', () => {
  it('queries and resolves only by the exact internal order id', async () => {
    const item = createOrder('order:internal:7', 'SW-20260826-0007');
    server.use(
      http.get('*/api/v1/orders', ({ request }) => {
        requests.push({
          url: new URL(request.url),
          scope: request.headers.get('x-scope-hint'),
          accessVersion: request.headers.get('x-access-version'),
        });
        return HttpResponse.json({ items: [item], count: 1 });
      })
    );
    const context = createContext('enterprise', 'enterprise:1', 7);

    await expect(readOrderDetail(context, item.id, new AbortController().signal)).resolves.toEqual(item);
    expect(Object.fromEntries(requests[0]?.url.searchParams ?? [])).toEqual({ order: item.id, limit: '1' });

    await expect(readOrderDetail(context, item.order_number, new AbortController().signal)).resolves.toBeUndefined();
    expect(requests[1]?.url.searchParams.get('order')).toBe(item.order_number);
  });
});

describe('Order page response bounds', () => {
  it('rejects a response containing 51 rows', () => {
    const items = Array.from({ length: ORDER_PAGE_LIMIT + 1 }, (_, index) => createOrder(`order:${index + 1}`, `SW-${index + 1}`));

    expect(OrderPageSchema.safeParse({ items, count: items.length }).success).toBe(false);
  });

  it('rejects count values that do not match the returned page', () => {
    const parsed = OrderPageSchema.safeParse({ items: [createOrder('order:1', 'SW-1')], count: 0 });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some(({ message }) => message === 'ORDER_PAGE_COUNT_MISMATCH')).toBe(true);
    }
  });
});

function createContext(kind: 'platform' | 'enterprise' | 'mall', id: string, accessVersion: number): ConsoleContext {
  const scope = { kind, id } as const;
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
      syncedAt: '2026-08-26T00:00:00Z',
    },
    profile: { display_name: '测试运营', employee_no: null },
    scope,
    scopes: [scope],
  };
}

function createOrder(id: string, orderNumber: string): OrderRecord {
  return {
    id,
    order_number: orderNumber,
    total_minor: 31_500,
    currency: 'CNY',
    payment_state: 'paid',
    fulfillment_state: 'allocated',
    aftersale_state: 'none',
    lifecycle_state: 'active',
    created_at: '2026-08-26T00:00:00Z',
    updated_at: '2026-08-26T00:01:00Z',
    version: 2,
  };
}
