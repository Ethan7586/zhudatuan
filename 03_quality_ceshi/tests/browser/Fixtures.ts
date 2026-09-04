export const storeSession = Object.freeze({
  actor: 'actor:store:e2e',
  membership: 'membership:store:e2e',
  capabilities: ['reporting.dashboard.read'],
  scopes: [{ kind: 'store', id: 'store:e2e' }],
  target: 'store',
  accessVersion: 1,
});

export const supplierSession = Object.freeze({
  actor: 'actor:supplier:e2e',
  membership: 'membership:supplier:e2e',
  capabilities: ['reporting.dashboard.read'],
  scopes: [{ kind: 'supplier', id: 'supplier:e2e' }],
  target: 'supplier',
  accessVersion: 1,
});

export const consoleSession = Object.freeze({
  actor: 'actor:console:e2e',
  membership: 'membership:console:e2e',
  scope: { kind: 'platform', id: 'platform:e2e', name: '测试平台' },
  scopes: [{ kind: 'platform', id: 'platform:e2e', name: '测试平台' }],
  accessVersion: 1,
  permissions: ['reporting.dashboard.read'],
  capabilities: ['reporting.dashboard.read'],
  assurance: { level: 1, verified: 'password' },
  target: 'console',
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
      period: { from: '2026.07.26', to: '2026.08.24' },
      conclusion: '本期经营保持增长；鸿泰甄选退款率上升，需要关注。',
      deltas: { netSalesRatio: 0.128, paidOrdersRatio: 0.086, averageOrderRatio: 0.039, refundRate: 0.028, refundRateDeltaPoints: 0.006 },
      trend: [
        { date: '2026-07-26', salesCents: 18200000, orderCount: 1080 }, { date: '2026-07-29', salesCents: 20400000, orderCount: 1190 },
        { date: '2026-08-01', salesCents: 22600000, orderCount: 1260 }, { date: '2026-08-04', salesCents: 21800000, orderCount: 1210 },
        { date: '2026-08-07', salesCents: 24700000, orderCount: 1370 }, { date: '2026-08-10', salesCents: 23800000, orderCount: 1320 },
        { date: '2026-08-13', salesCents: 26900000, orderCount: 1460 }, { date: '2026-08-15', salesCents: 25100000, orderCount: 1400 },
        { date: '2026-08-18', salesCents: 30200000, orderCount: 1720 }, { date: '2026-08-20', salesCents: 27900000, orderCount: 1560 },
        { date: '2026-08-22', salesCents: 29100000, orderCount: 1620 }, { date: '2026-08-24', salesCents: 23100000, orderCount: 1330 },
      ],
      weeklyTrend: [
        { date: '2026-07-26', salesCents: 128000000, orderCount: 7640 }, { date: '2026-08-02', salesCents: 141000000, orderCount: 8120 },
        { date: '2026-08-09', salesCents: 156000000, orderCount: 9230 }, { date: '2026-08-16', salesCents: 163000000, orderCount: 9810 },
      ],
      malls: [
        { id: 'mall:huimin', name: '鸿泰惠民通', salesCents: 148620000, paidOrderCount: 11326, refundRate: 0.021 },
        { id: 'mall:zhenxuan', name: '鸿泰甄选', salesCents: 100012000, paidOrderCount: 7316, refundRate: 0.041 },
      ],
      events: [
        { id: 'event:member', kind: 'calendar', title: '鸿泰惠民通会员日完成', metric: '成交额 ¥186,420', time: '20:42', date: '2026-08-18' },
        { id: 'event:refund', kind: 'warning', title: '鸿泰甄选售后申请增加', metric: '退款率 4.1%', time: '20:18', date: '2026-08-22' },
        { id: 'event:sync', kind: 'sync', title: '集团支付订单完成同步', metric: '18,642 单', time: '19:52' },
      ],
      insights: [
        { id: 'insight:refund', tone: 'warning', title: '鸿泰甄选退款率高于集团均值 1.3 个百分点', action: '查看售后订单', target: 'orders' },
        { id: 'insight:conversion', tone: 'positive', title: '鸿泰惠民通支付转化率连续 3 日回升', action: '查看商城分析', target: 'reports' },
      ],
      categories: [],
      topProducts: [],
    },
  },
});

export const controlHealth = Object.freeze({
  status: 'degraded',
  queue: { queued: 12, running: 3, deadletters: 1, oldest_seconds: 720 },
  cache: { available: true },
  databaseQueries: [],
  compatibility: {
    healthy: true,
    contract: { checksum: 'preview-contract', matches: true },
    schema: { version: 'preview-schema', matches: true },
    registries: { operations: 204, events: 55, jobs: 18 },
    database: { writable: true, schema: true, contract: true, operations: 204, capabilities: 96, events: 55 },
  },
  controlPlane: {
    evaluatedAt: '2026-08-24T21:12:00+08:00', coverageRatio: 0.96, region: '华北', cell: 'Cell C03', assurance: 'AAL2',
    conclusion: '平台整体稳定，但有 1 项需要立即处置、2 项需要关注。', summary: '当前覆盖 11/12 项能力；其他 Cell 正常。',
    incidents: [
      { id: 'OP-240824-1042', priority: 'P1', title: '商品同步连续失败', impact: '影响：2 个商城 · 436 个商品', startedAt: '20:47', retryCount: 2,
        cause: '供应商授权凭证过期', owner: '张睿', slaMinutes: 18, action: '执行恢复', affectedCapabilities: ['catalog', 'supplier'] },
      { id: 'OP-240824-1048', priority: 'P2', title: '支付对账任务延迟', impact: '影响今日 173 笔订单 · 已延迟 12 分钟', action: '查看详情', affectedCapabilities: ['payment'] },
      { id: 'CHANGE-v34', priority: 'CHANGE', title: '配置 v34 等待生效确认', impact: '变更人：王宁 · 21:03', action: '去确认', affectedCapabilities: ['catalog'] },
    ],
    capabilities: [
      { id: 'identity', title: '身份与 Scope', status: 'stable', group: 'core' }, { id: 'catalog', title: '商品能力', status: 'action', group: 'core' },
      { id: 'order', title: '订单能力', status: 'stable', group: 'core' }, { id: 'payment', title: '支付与对账', status: 'attention', group: 'core' },
      { id: 'fulfillment', title: '履约与售后', status: 'stable', group: 'core' }, { id: 'channel', title: '渠道与分销', status: 'stable', group: 'side' },
      { id: 'supplier', title: '供应商协同', status: 'attention', group: 'side' }, { id: 'risk', title: '风险与审计', status: 'stable', group: 'side' },
    ],
    changes: [{ id: 'change:v34', title: '配置版本 v34 · 灰度 10%', target: '鸿泰集团 2 个商城', stopCondition: '失败率 ≥ 1%', rollbackEstimate: '2 分钟', status: 'running' }],
    audits: [
      { id: 'audit:1', time: '20:31', title: '权限策略更新', detail: '已验证', status: 'verified' },
      { id: 'audit:2', time: '20:47', title: '供应商授权校验失败', detail: 'OP-240824-1042', status: 'failed' },
      { id: 'audit:3', time: '21:03', title: '配置 v34 发布', detail: '等待验证', status: 'pending' },
    ],
  },
});

export const publication = Object.freeze({
  hash: 'a'.repeat(64),
  document: {
    version: 2,
    application: 'application:e2e',
    pages: [
      {
        id: 'home',
        path: '/',
        blocks: [
          {
            id: 'hero',
            component: 'hero',
            content: {
              eyebrow: '企业福利专享',
              title: '智慧翼福利首页测试',
              description: '真实浏览器验证公开商城体验。',
            },
          },
        ],
      },
    ],
  },
});
