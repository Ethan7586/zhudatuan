// @vitest-environment node
import { HttpResponse, delay, http, type JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../entity/session/ConsoleSession';
import { CockpitGateway } from './cockpit/infrastructure/CockpitGateway';
import { readControl } from './control/ControlQuery';
import { FinanceGateway } from './finance/infrastructure/FinanceGateway';
import { OrderGateway } from './order/infrastructure/OrderGateway';
import { EMPTY_ORDER_LIST_FILTER } from './order/model/OrderFilter';
import { ProductGateway } from './product/infrastructure/ProductGateway';
import { NAVIGATION_CATALOG_HASH } from '../generated/NavigationBinding';
import { appConfig } from '../shared/config/AppConfig';

const products = new ProductGateway({ apiBaseUrl: appConfig.apiBaseUrl, clientVersion: appConfig.clientVersion, catalogVersion: NAVIGATION_CATALOG_HASH });
const cockpit = new CockpitGateway(appConfig.apiBaseUrl);
const orders = new OrderGateway(appConfig.apiBaseUrl);
const finance = new FinanceGateway(appConfig.apiBaseUrl);

const requests: URL[] = [];
const empty = { items: [], count: 0 };
const server = setupServer(
  http.get('*/api/v1/catalog/listings', record(empty)),
  http.get(
    '*/api/v1/catalog/products/:productid',
    record({
      id: 'product:1',
      title: '测试商品',
      product_type: 'physical',
      status: 'active',
      version: '1',
      category_id: 'category:1',
      brand_id: null,
      owner_partner_id: 'partner:1',
      cover_url: null,
      subtitle: null,
      skus: [],
      listings: [],
      inventory: [],
      prices: [],
    })
  ),
  http.get('*/api/v1/orders', record(empty)),
  http.get('*/api/v1/finance/overview', record({ items: [] })),
  http.get('*/api/v1/organizations/layers', record(empty)),
  http.get(
    '*/api/v1/reports/dashboard',
    record({
      ...empty,
      summary: {
        catalogCount: 0,
        availableStock: 0,
        orderCount: 0,
        afterSaleCount: 0,
        sales: {
          asOf: '2026-08-26T00:00:00Z',
          cumulativeSalesCents: 0,
          paidOrderCount: 0,
          averageOrderValueCents: 0,
          periodSalesCents: 0,
          periodPaidOrderCount: 0,
          refundedCents: 0,
          activeProductCount: 0,
          soldProductCount: 0,
          unsoldActiveProductCount: 0,
          period: { from: '2026-08-01T00:00:00Z', to: '2026-08-31T00:00:00Z' },
          conclusion: '当前周期暂无成交。',
          deltas: { netSalesRatio: null, paidOrdersRatio: null, averageOrderRatio: null, refundRate: 0, refundRateDeltaPoints: null },
          trend: [],
          weeklyTrend: [],
          categories: [],
          topProducts: [],
          malls: [],
          events: [],
          insights: [],
        },
      },
    })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Console named read Operations', () => {
  it('sends explicit scope and access version through isolated list and detail readers', async () => {
    const signal = new AbortController().signal;
    await Promise.all([
      cockpit.read(context, { period: '30days' }, signal),
      readControl(context, undefined, signal),
      finance.overview(context, signal),
      orders.orders(context, { ...EMPTY_ORDER_LIST_FILTER, order: 'SW1', view: 'all' }, signal),
      products.readProducts(productRequest(), { q: '', category: '', limit: 50 }, signal),
      products.readProduct(productRequest(), 'product:1', signal),
    ]);
    expect(requests).toHaveLength(6);
    expect(requests.map(({ pathname }) => pathname).sort()).toEqual([
      '/api/v1/catalog/listings',
      '/api/v1/catalog/products/product%3A1',
      '/api/v1/finance/overview',
      '/api/v1/orders',
      '/api/v1/organizations/layers',
      '/api/v1/reports/dashboard',
    ]);
    expect(requests.find(({ pathname }) => pathname.endsWith('/listings'))?.searchParams.get('limit')).toBe('50');
    expect(requests.find(({ pathname }) => pathname.endsWith('/orders'))?.searchParams.get('limit')).toBe('50');
  });

  it('propagates scope-navigation cancellation into the Operation request', async () => {
    server.use(
      http.get('*/api/v1/catalog/listings', async () => {
        await delay('infinite');
        return HttpResponse.json(empty);
      })
    );
    const controller = new AbortController();
    const pending = products.readProducts(productRequest(), { q: '', category: '', limit: 50 }, controller.signal);
    controller.abort(new Error('SCOPE_CHANGED'));
    await expect(pending).rejects.toThrow();
  });
});

function record(body: JsonBodyType) {
  return ({ request }: { request: Request }) => {
    expect(request.headers.get('x-scope-hint')).toBe('platform:1');
    expect(request.headers.get('x-access-version')).toBe('7');
    requests.push(new URL(request.url));
    return HttpResponse.json(body);
  };
}

const context: ConsoleContext = {
  session: {
    actor: 'actor:1',
    membership: 'membership:1',
    accessVersion: 7,
    permissions: [],
    capabilities: [],
    target: 'console',
    scope: { kind: 'platform', id: 'platform:1' },
    scopes: [{ kind: 'platform', id: 'platform:1' }],
    assurance: { level: 1 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    syncedAt: '2026-08-26T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'platform', id: 'platform:1' },
  scopes: [{ kind: 'platform', id: 'platform:1' }],
};

function productRequest() {
  return { scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion } as const;
}
