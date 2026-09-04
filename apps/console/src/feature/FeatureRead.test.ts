// @vitest-environment node
import { HttpResponse, delay, http, type JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../entity/session/ConsoleSession';
import { CockpitGateway } from './cockpit/infrastructure/CockpitGateway';
import { ControlGateway } from './control/infrastructure/ControlGateway';
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
const control = new ControlGateway(appConfig.apiBaseUrl);

const requests: URL[] = [];
const empty = { items: [], count: 0 };
const server = setupServer(
  http.get('*/api/v1/catalog/listings', record(empty)),
  http.get('*/api/v1/catalog/facets', record({ categories: [], suppliers: [], malls: [], statuses: [] })),
  http.get(
    '*/api/v1/catalog/products/:productid',
    record({
      section: 'core',
      id: 'product:1',
      title: '测试商品',
      description: null,
      product_type: 'physical',
      status: 'active',
      version: 1,
      category_id: 'category:1',
      brand_id: null,
      owner_partner_id: 'partner:1',
      cover_url: null,
      subtitle: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
      skus: [],
      listings: [],
      media: [],
      channels: [],
      pools: [],
      timeline: [],
      inventory: [],
      prices: [],
      qualifications: [],
      dependencies: {
        catalog: { state: 'ready', watermark: null, code: null },
        inventory: { state: 'notrequested', watermark: null, code: null },
        pricing: { state: 'notrequested', watermark: null, code: null },
        qualification: { state: 'notrequested', watermark: null, code: null },
      },
      gaps: [],
    })
  ),
  http.get(
    '*/api/v1/orders',
    record({
      ...empty,
      facets: {
        state: 'ready',
        data: {
          counts: { all: 0, unpaid: 0, unshipped: 0, active: 0, completed: 0, aftersale: 0, exception: 0 },
          watermarks: { order: null, payment: null, fulfillment: null, aftersale: null, refund: null },
        },
      },
    })
  ),
  http.get('*/api/v1/finance/overview', record({ items: [] })),
  http.get('*/api/v1/organizations/layers', record(empty)),
  http.get(
    '*/api/v1/reports/dashboard',
    record({
      ...empty,
      snapshot: {
        query: { scope: 'enterprise:1', dimension: null, period: '30days', application: null },
        watermark: { event: 'event:one', occurredAt: '2026-08-26T00:00:00Z', version: 1 },
        generatedAt: '2026-08-26T00:00:01Z',
        generationVersion: 1,
      },
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
      control.platform(context, undefined, signal),
      finance.overview(context, signal),
      orders.orders(context, { ...EMPTY_ORDER_LIST_FILTER, search: 'SW1', view: 'all' }, signal),
      products.readProducts(productRequest(), { q: '', category: '', supplier: '', mall: '', status: '', limit: 50 }, signal),
      products.readFacets(productRequest(), { q: '' }, signal),
      products.readProduct(productRequest(), 'product:1', 'core', signal),
    ]);
    expect(requests).toHaveLength(7);
    expect(requests.map(({ pathname }) => pathname).sort()).toEqual([
      '/api/v1/catalog/facets',
      '/api/v1/catalog/listings',
      '/api/v1/catalog/products/product%3A1',
      '/api/v1/finance/overview',
      '/api/v1/orders',
      '/api/v1/organizations/layers',
      '/api/v1/reports/dashboard',
    ]);
    expect(requests.find(({ pathname }) => pathname.endsWith('/listings'))?.searchParams.get('limit')).toBe('50');
    expect(requests.find(({ pathname }) => pathname.includes('/products/'))?.searchParams.get('section')).toBe('core');
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
    const pending = products.readProducts(productRequest(), { q: '', category: '', supplier: '', mall: '', status: '', limit: 50 }, controller.signal);
    controller.abort(new Error('SCOPE_CHANGED'));
    await expect(pending).rejects.toThrow();
  });

  it('propagates filter cancellation into the independent Facet request', async () => {
    server.use(
      http.get('*/api/v1/catalog/facets', async () => {
        await delay('infinite');
        return HttpResponse.json({ categories: [], suppliers: [], malls: [], statuses: [] });
      })
    );
    const controller = new AbortController();
    const pending = products.readFacets(productRequest(), { q: '旧条件' }, controller.signal);
    controller.abort(new Error('FILTER_CHANGED'));
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
