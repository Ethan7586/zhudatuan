// @vitest-environment node
import { HttpResponse, delay, http, type JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../entity/session/ConsoleSession';
import { readCockpit } from './cockpit/CockpitQuery';
import { readControl } from './control/ControlQuery';
import { readFinance } from './finance/FinanceQuery';
import { ORDER_DEFAULT_PAGE_LIMIT, readOrders } from './order/OrderQuery';
import { PRODUCT_CATALOG_DEFAULT_PAGE_LIMIT, readProducts } from './product/ProductQuery';

const requests: URL[] = [];
const empty = { items: [], count: 0 };
const server = setupServer(
  http.get('*/api/v1/catalog/listings', record(empty)),
  http.get('*/api/v1/orders', record(empty)),
  http.get('*/api/v1/finance/overview', record(empty)),
  http.get('*/health/dependency', record({ status: 'available', queue: { queued: 0, running: 0, deadletters: 0, oldest_seconds: 0 },
    cache: { available: true }, databaseQueries: [], compatibility: { healthy: true,
      contract: { checksum: 'contract:1', matches: true }, schema: { version: 'schema:1', matches: true },
      registries: { operations: 1, events: 1, jobs: 1 },
      database: { writable: true, schema: true, contract: true, operations: 1, capabilities: 1, events: 1 } } })),
  http.get('*/api/v1/reports/dashboard', record({ ...empty, summary: { catalogCount: 0, availableStock: 0, orderCount: 0,
    afterSaleCount: 0, sales: { asOf: '2026-08-26T00:00:00Z', cumulativeSalesCents: 0, paidOrderCount: 0,
      averageOrderValueCents: 0, periodSalesCents: 0, periodPaidOrderCount: 0, refundedCents: 0, activeProductCount: 0,
      soldProductCount: 0, unsoldActiveProductCount: 0, trend: [], categories: [], topProducts: [] } } })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { requests.length = 0; server.resetHandlers(); });
afterAll(() => server.close());

describe('Console named read Operations', () => {
  it('sends explicit scope and access version through five isolated readers', async () => {
    const signal = new AbortController().signal;
    await Promise.all([
      readCockpit(context, '30days', signal), readControl(context, signal), readFinance(context, signal),
      readOrders(context, { order: 'SW1' }, signal), readProducts(context, { q: '牛奶', category: 'food' }, signal),
    ]);
    expect(requests).toHaveLength(5);
    expect(requests.map(({ pathname }) => pathname).sort()).toEqual([
      '/api/v1/catalog/listings', '/api/v1/finance/overview', '/api/v1/orders', '/api/v1/reports/dashboard', '/health/dependency',
    ]);
    expect(requests.find(({ pathname }) => pathname.endsWith('/listings'))?.searchParams.get('limit')).toBe(String(PRODUCT_CATALOG_DEFAULT_PAGE_LIMIT));
    expect(requests.find(({ pathname }) => pathname.endsWith('/orders'))?.searchParams.get('limit')).toBe(String(ORDER_DEFAULT_PAGE_LIMIT));
  });

  it('propagates scope-navigation cancellation into the Operation request', async () => {
    server.use(http.get('*/api/v1/catalog/listings', async () => {
      await delay('infinite');
      return HttpResponse.json(empty);
    }));
    const controller = new AbortController();
    const pending = readProducts(context, { q: '', category: '' }, controller.signal);
    controller.abort(new Error('SCOPE_CHANGED'));
    await expect(pending).rejects.toThrow();
  });

  it('requests the compact supply-network projection without a product page payload', async () => {
    await readProducts(context, {
      q: '', category: '', limit: 1, preview: true, view: 'supply-network',
    }, new AbortController().signal);
    const request = requests[0];
    expect(request?.searchParams.get('view')).toBe('supply-network');
    expect(request?.searchParams.get('limit')).toBe('1');
  });
});

function record(body: JsonBodyType) {
  return ({ request }: { request: Request }) => {
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:1');
    expect(request.headers.get('x-access-version')).toBe('7');
    requests.push(new URL(request.url));
    return HttpResponse.json(body);
  };
}

const context: ConsoleContext = {
  session: { actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [], capabilities: [], target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
    assurance: { level: 1 }, syncedAt: '2026-08-26T00:00:00Z' },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
};
