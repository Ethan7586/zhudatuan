// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import type { OrderQuery } from './OrderQuery';

const api = vi.hoisted(() => ({ ordersRead: vi.fn() }));
vi.mock('@shop/sdk/order', () => ({
  createFetchOrderOrdersRead: () => api.ordersRead,
  createFetchOrderOrdersExport: () => vi.fn(),
}));
vi.mock('@shop/sdk/reporting', () => ({ createFetchReportingExportsRead: () => vi.fn() }));

import { readOrders } from './OrderQuery';

const response = { items: [], count: 0, exports: [] };
const prefetchQuery = {
  order: '', placed: '', lifecycle: '', payment: '', fulfillment: '', mall: '', view: 'all',
} as const;
const query: OrderQuery = prefetchQuery;
const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [],
    capabilities: ['order.orders.read'], target: 'console',
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
};

afterEach(() => {
  delete window.__consoleOrderPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.ordersRead.mockReset();
});

describe('order document prefetch', () => {
  it('uses the exact prefetched order page without repeating the SDK request', async () => {
    window.__consoleOrderPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, query: prefetchQuery, value: response,
    });

    await expect(readOrders(context, query, new AbortController().signal)).resolves.toMatchObject({ count: 0 });
    expect(api.ordersRead).not.toHaveBeenCalled();
  });

  it('falls back when any prefetched filter differs', async () => {
    window.__consoleOrderPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7,
      query: { ...prefetchQuery, view: 'unpaid' }, value: response,
    });
    api.ordersRead.mockResolvedValue(response);

    await readOrders(context, query, new AbortController().signal);
    expect(api.ordersRead).toHaveBeenCalledOnce();
  });

  it('cancels the document request when route navigation aborts', async () => {
    window.__consoleOrderPrefetch = { settled: false, promise: new Promise(() => undefined) };
    window.__consoleAbortDocumentPrefetch = vi.fn();
    const controller = new AbortController();

    const reading = readOrders(context, query, controller.signal);
    controller.abort(new DOMException('navigation cancelled', 'AbortError'));

    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
    expect(window.__consoleAbortDocumentPrefetch).toHaveBeenCalledOnce();
    expect(api.ordersRead).not.toHaveBeenCalled();
  });
});

function resolvedPrefetch<T>(value: T) {
  return { settled: true, promise: Promise.resolve(value) };
}
