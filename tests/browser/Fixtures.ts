export const consoleSession = Object.freeze({
  actor: 'actor:console:e2e',
  session: 'session:console:e2e',
  membership: 'membership:console:e2e',
  scope: { kind: 'enterprise', id: 'enterprise:e2e', name: '测试集团' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:e2e', name: '测试集团' }],
  accessVersion: 1,
  permissions: ['reporting.dashboard.read', 'catalog.pool.read', 'order.read', 'finance.overview.read'],
  capabilities: ['reporting.dashboard.read', 'catalog.pools.read', 'order.orders.read', 'finance.overview.read'],
  assurance: { level: 1, verified: 'password' },
  target: 'console',
  security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: '2026-08-01T00:00:00.000Z' },
  syncedAt: '2026-08-26T06:00:00.000Z',
});

export const cockpit = Object.freeze({
  items: [],
  count: 0,
  summary: {
    catalogCount: 5008,
    availableStock: 4200,
    orderCount: 7,
    afterSaleCount: 1,
    sales: {
      asOf: '2026-08-26T06:00:00.000Z',
      cumulativeSalesCents: 248632000,
      paidOrderCount: 18642,
      averageOrderValueCents: 13336,
      periodSalesCents: 248632000,
      periodPaidOrderCount: 18642,
      refundedCents: 6961696,
      activeProductCount: 5008,
      soldProductCount: 7,
      unsoldActiveProductCount: 5001,
      trend: [
        { date: '2026-07-26', salesCents: 18200000, orderCount: 1080 },
        { date: '2026-07-29', salesCents: 20400000, orderCount: 1190 },
        { date: '2026-08-01', salesCents: 22600000, orderCount: 1260 },
        { date: '2026-08-04', salesCents: 21800000, orderCount: 1210 },
        { date: '2026-08-07', salesCents: 24700000, orderCount: 1370 },
        { date: '2026-08-10', salesCents: 23800000, orderCount: 1320 },
        { date: '2026-08-13', salesCents: 26900000, orderCount: 1460 },
        { date: '2026-08-15', salesCents: 25100000, orderCount: 1400 },
        { date: '2026-08-18', salesCents: 30200000, orderCount: 1720 },
        { date: '2026-08-20', salesCents: 27900000, orderCount: 1560 },
        { date: '2026-08-22', salesCents: 29100000, orderCount: 1620 },
        { date: '2026-08-24', salesCents: 23100000, orderCount: 1330 },
      ],
      categories: [],
      topProducts: [],
    },
  },
});

const storefrontAsOf = '2026-08-31T00:00:00.000Z';

export const storefrontBootstrap = Object.freeze({
  state: 'complete',
  host: '127.0.0.1',
  binding: {
    application: 'application:e2e',
    mall: 'mall:e2e',
    pool: 'pool:e2e',
    release: 'release:e2e',
    version: 'binding:1',
    scope: 'enterprise:e2e',
  },
  identity: {
    state: 'complete',
    version: '0',
    asOf: storefrontAsOf,
    data: { state: 'anonymous', member: null, membership: null },
  },
  navigation: { state: 'complete', version: '1', asOf: storefrontAsOf, data: [] },
  benefit: { state: 'unavailable', version: '0', asOf: storefrontAsOf, data: null },
  orders: { state: 'unavailable', version: '0', asOf: storefrontAsOf, data: null },
  experience: { state: 'complete', version: '1', asOf: storefrontAsOf, data: { pages: [] } },
});

export const storefrontCatalog = Object.freeze({
  items: [],
  nextCursor: null,
  version: 'catalog:1',
  asOf: storefrontAsOf,
});
