import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { Component } from './OrderRoute';
import { Component as OrderDetailComponent } from './OrderDetailRoute';
import { DependencyProvider } from '../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { StepupProvider } from '../../../entity/session/StepupContext';
import { streamingFile } from '../../../../test/StreamingFile';

const order = {
  id: 'order:internal-1',
  order_number: 'SW202608260001',
  scope_id: 'enterprise:1',
  member_id: 'member:verified-1',
  mall_id: 'mall:verified-1',
  checkout_id: 'checkout:verified-1',
  total_minor: 12_800,
  currency: 'CNY',
  payment_state: 'paid',
  fulfillment_state: 'allocated',
  aftersale_state: 'none',
  lifecycle_state: 'paid',
  address: { recipientMasked: '张**', mobileMasked: '138****8000', addressMasked: '上海市浦东新区****路', regionCode: '310115' },
  payment: {
    paymentId: 'payment:verified-1',
    version: 0,
    capturedMinor: 12_800,
    refundedMinor: 0,
    refundableMinor: 12_800,
    updatedAt: '2026-08-26T08:40:00.000Z',
    tenders: [
      { sequence: 1, kind: 'benefit', referenceMasked: '尾号 0001', amountMinor: 8_000, state: 'captured' },
      { sequence: 2, kind: 'wechat', referenceMasked: null, amountMinor: 4_800, state: 'captured' },
    ],
  },
  fulfillments: [
    {
      id: 'fulfillment:verified-1',
      provider: null,
      partner: null,
      kind: 'shipment',
      state: 'processing',
      version: 0,
      externalReferenceMasked: null,
      createdAt: '2026-08-26T08:41:00.000Z',
      updatedAt: '2026-08-26T08:42:00.000Z',
      milestones: [],
    },
  ],
  refunds: [],
  timeline: [
    { id: 'audit:1', action: 'fulfillment.shipments.create', resourceType: 'fulfillment', resourceMasked: 'fulfillment ····ed-1', actorMasked: 'console ····or-1', occurredAt: '2026-08-26T08:42:00.000Z', traceMasked: '追踪 ····0001' },
  ],
  receivedAt: null,
  created_at: '2026-08-26T08:30:00.000Z',
  updated_at: '2026-08-26T09:00:00.000Z',
  version: 11,
  lines: [
    {
      id: 'line:1',
      sku: 'SKU-VERIFIED-1',
      listing: 'listing:1',
      title: '权威商品标题',
      quantity: 2,
      unitMinor: 6_400,
      totalMinor: 12_800,
      discountMinor: 0,
      payableMinor: 12_800,
      productType: 'physical',
      category: 'category:office',
      provider: null,
      partner: null,
    },
  ],
} as const;

const listPage = {
  items: [order],
  count: 1,
  nextCursor: 'cursor:next',
  facets: {
    state: 'ready',
    data: {
      counts: { all: 1, unpaid: 0, unshipped: 1, active: 0, completed: 0, aftersale: 1, exception: 0 },
      watermarks: { order: order.updated_at, payment: order.payment.updatedAt, fulfillment: order.fulfillments[0].updatedAt, aftersale: null, refund: null },
    },
  },
} as const;

const emptyFacets = {
  state: 'ready',
  data: {
    counts: { all: 0, unpaid: 0, unshipped: 0, active: 0, completed: 0, aftersale: 0, exception: 0 },
    watermarks: { order: null, payment: null, fulfillment: null, aftersale: null, refund: null },
  },
} as const;

const detail = {
  summary: {
    id: order.id,
    orderNumber: order.order_number,
    scopeId: order.scope_id,
    mallId: order.mall_id,
    currency: order.currency,
    totalMinor: order.total_minor,
    paymentState: order.payment_state,
    fulfillmentState: order.fulfillment_state,
    aftersaleState: order.aftersale_state,
    lifecycleState: order.lifecycle_state,
    sourceChannel: null,
    externalOrderNo: null,
    sourceState: null,
    verificationState: 'verified',
    orderedAt: order.created_at,
    address: order.address,
    receivedAt: order.receivedAt,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    version: order.version,
  },
  products: { state: 'ready', data: order.lines },
  payment: { state: 'ready', data: order.payment },
  fulfillment: { state: 'ready', data: order.fulfillments },
  aftersale: { state: 'ready', data: { state: order.aftersale_state, refunds: order.refunds } },
  finance: {
    state: 'ready',
    data: {
      grossMinor: order.total_minor,
      capturedMinor: order.payment.capturedMinor,
      refundedMinor: order.payment.refundedMinor,
      netMinor: order.payment.capturedMinor - order.payment.refundedMinor,
      outstandingMinor: 0,
      currency: order.currency,
      state: 'balanced',
      verificationState: 'verified',
      watermark: order.updated_at,
    },
  },
  audit: { state: 'ready', data: order.timeline },
} as const;

const aftersale = {
  id: 'aftersale:verified-1',
  orderId: order.id,
  orderNumber: order.order_number,
  state: 'reviewing',
  reasonCode: 'damaged',
  description: '外包装破损',
  currency: 'CNY',
  expectedRefundMinor: 6_400,
  expectedRefund: { totalMinor: 6_400, currency: 'CNY', tenders: [{ kind: 'benefit', reference: null, amountMinor: 6_400 }] },
  requiresReturn: true,
  unavailableReason: null,
  requestedBy: 'actor:member-1',
  createdAt: '2026-08-27T08:30:00.000Z',
  updatedAt: '2026-08-27T09:00:00.000Z',
  version: 2,
  lines: [],
  attachments: [],
  timeline: [{ sequence: 1, kind: 'application', previousState: null, state: 'applied', evidence: {}, occurredAt: '2026-08-27T08:30:00.000Z' }],
} as const;

const context: ConsoleContext = {
  session: {
    actor: 'actor:1',
    membership: 'membership:1',
    accessVersion: 7,
    csrf: 'csrf:order-test',
    permissions: ['order.export', 'order.import.manage', 'order.aftersale.decide', 'order.receive', 'order.reminder.create', 'support.case.read'],
    capabilities: ['order.orders.export', 'order.imports.create', 'order.aftersales.approve', 'order.aftersales.reject', 'order.orders.receive', 'order.reminders.create', 'support.cases.read'],
    target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:1' },
    scopes: [
      { kind: 'enterprise', id: 'enterprise:1' },
      { kind: 'mall', id: 'mall:verified-1', name: '员工福利商城' },
    ],
    assurance: { level: 3, verified: '2026-08-26T08:00:00.000Z' },
    security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
    syncedAt: '2026-08-26T08:00:00.000Z',
  },
  profile: { display_name: '测试订单运营', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:1' },
  scopes: [
    { kind: 'enterprise', id: 'enterprise:1' },
    { kind: 'mall', id: 'mall:verified-1', name: '员工福利商城' },
  ],
};

const getRequests: URL[] = [];
const server = setupServer(
  http.get('*/api/v1/orders', ({ request }) => {
    const url = new URL(request.url);
    getRequests.push(url);
    if (request.headers.get('x-scope-hint') !== 'enterprise:1' || request.headers.get('x-access-version') !== '7') {
      return HttpResponse.json({ code: 'TEST_CONTEXT_MISSING', requestId: 'request:order-test' }, { status: 400 });
    }
    return HttpResponse.json(listPage);
  }),
  http.get('*/api/v1/orders/aftersales', ({ request }) => {
    const url = new URL(request.url);
    getRequests.push(url);
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:1');
    return HttpResponse.json({ items: [aftersale], count: 1, availableLines: [] });
  }),
  http.get('*/api/v1/orders/:orderId', ({ request, params }) => {
    getRequests.push(new URL(request.url));
    return params.orderId === order.id || params.orderId === order.order_number ? HttpResponse.json(detail) : HttpResponse.json({ code: 'RESOURCE_NOT_FOUND', requestId: 'request:not-found' }, { status: 404 });
  }),
  http.get('*/api/v1/support/cases', () => HttpResponse.json({ items: [], count: 0 }))
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  getRequests.length = 0;
  window.localStorage.clear();
});
afterAll(() => server.close());

describe('Order route', () => {
  it('renders the authoritative detail from an independently restorable deep link', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <MemoryRouter initialEntries={[`/scopes/enterprise/enterprise%3A1/orders/${encodeURIComponent(order.id)}`]}>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={context}>
            <StepupProvider controller={{ request: () => undefined }}>
              <DependencyProvider value={createConsoleDependencies()}>
                <Routes>
                  <Route path="/scopes/:scopeKind/:scopeId/orders/:orderId" element={<OrderDetailComponent />} />
                </Routes>
              </DependencyProvider>
            </StepupProvider>
          </ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { level: 1, name: order.order_number })).toBeTruthy();
    for (const label of ['概览', '商品', '支付', '履约', '售后', '财务', '客服', '审计']) expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('tab', { name: '商品' }));
    expect(screen.getByRole('table', { name: '订单商品明细' })).toBeTruthy();
    expect(screen.getAllByText('权威商品标题')).toHaveLength(1);
    expect(getRequests.some((url) => url.pathname.endsWith(`/api/v1/orders/${encodeURIComponent(order.id)}`))).toBe(true);
  });

  it('hides unauthorized detail partitions and repairs a forbidden section deep link', async () => {
    server.use(
      http.get('*/api/v1/orders/:orderId', () =>
        HttpResponse.json({
          ...detail,
          payment: { state: 'hidden' },
          finance: { state: 'hidden' },
          audit: { state: 'hidden' },
        })
      )
    );
    const restricted = {
      ...context,
      session: {
        ...context.session,
        permissions: context.session.permissions.filter((permission) => permission !== 'support.case.read'),
        capabilities: context.session.capabilities.filter((capability) => capability !== 'support.cases.read'),
      },
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <MemoryRouter initialEntries={[`/scopes/enterprise/enterprise%3A1/orders/${encodeURIComponent(order.id)}?section=finance`]}>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={restricted}>
            <StepupProvider controller={{ request: () => undefined }}>
              <DependencyProvider value={createConsoleDependencies()}>
                <Routes>
                  <Route path="/scopes/:scopeKind/:scopeId/orders/:orderId" element={<OrderDetailComponent />} />
                </Routes>
              </DependencyProvider>
            </StepupProvider>
          </ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('tab', { name: '概览' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: '支付' })).toBeNull();
    expect(screen.queryByRole('tab', { name: '财务' })).toBeNull();
    expect(screen.queryByRole('tab', { name: '客服' })).toBeNull();
    expect(screen.queryByRole('tab', { name: '审计' })).toBeNull();
    await waitFor(() => expect(screen.getByRole('tab', { name: '概览' }).getAttribute('aria-selected')).toBe('true'));
  });

  it('renders production-authoritative payment, fulfillment, address and audit data without placeholders', async () => {
    renderRoute();

    expect(await screen.findByRole('table', { name: '订单列表' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '订单管理' })).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('由服务端按当前数据范围权威筛选');
    expect(screen.getByText('当前条件由服务端实时筛选')).toBeTruthy();
    expect(screen.getByText('第 1 页 · 本页 1 条')).toBeTruthy();
    expect(screen.getByText(/^会员 \d{4} \d{4}$/)).toBeTruthy();
    expect(screen.getByText(/^组织范围 \d{4} \d{4}$/)).toBeTruthy();
    expect(screen.queryByText('member:verified-1')).toBeNull();
    expect(screen.queryByText('enterprise:1')).toBeNull();
    expect(screen.queryByText(order.id)).toBeNull();
    expect(screen.queryByText('SKU-VERIFIED-1')).toBeNull();
    expect(screen.getByText(order.order_number).tagName).toBe('STRONG');
    expect(screen.getByText(/^商品规格 \d{4} \d{4} · 共 2 件$/)).toBeTruthy();
    expect(screen.queryByText('不应泄漏的演示会员')).toBeNull();
    expect(screen.queryByText('不应泄漏的演示支付方式')).toBeNull();
    expect(screen.getByRole('button', { name: '全部订单' }).textContent).toBe('全部订单1');

    for (const label of ['全部订单', '待付款', '待发货', '履约中', '已完成', '售后与退款', '异常订单']) {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: label }).disabled).toBe(false);
    }
    for (const label of ['下单时间', '订单进度', '支付状态', '履约状态', '所属商城']) {
      expect(screen.getByRole<HTMLSelectElement>('combobox', { name: label }).disabled).toBe(false);
    }
    expect(screen.getByRole('button', { name: '导出订单' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '导入外部订单' })).toBeTruthy();

    await userEvent.setup().click(screen.getByRole('button', { name: `查看订单 ${order.order_number}` }));
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) }, { timeout: 5_000 });
    expect(within(dialog).getAllByText('¥128.00').length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/张\*\* · 138\*\*\*\*8000/)).toBeTruthy();
    expect(within(dialog).getByText(/最近操作：/)).toBeTruthy();
    expect(within(dialog).queryByText(/当前读模型未提供/)).toBeNull();
    expect(within(dialog).queryByText('不应泄漏的演示说明')).toBeNull();
  });

  it('sends status tabs and combined filters to the server instead of filtering the current page', async () => {
    const user = userEvent.setup();
    renderRoute('/orders?cursor=cursor%3Aold&campaign=keep');
    await screen.findByRole('table', { name: '订单列表' });

    await user.click(screen.getByRole('button', { name: '待付款' }));
    await waitFor(() => expect(getRequests.some((url) => url.searchParams.get('view') === 'unpaid')).toBe(true));
    expect(currentParams().get('cursor')).toBeNull();
    expect(currentParams().get('campaign')).toBe('keep');

    await user.selectOptions(screen.getByRole('combobox', { name: '下单时间' }), '7days');
    await user.selectOptions(screen.getByRole('combobox', { name: '订单进度' }), 'paid');
    await user.selectOptions(screen.getByRole('combobox', { name: '支付状态' }), 'paid');
    await user.selectOptions(screen.getByRole('combobox', { name: '履约状态' }), 'allocated');
    await user.selectOptions(screen.getByRole('combobox', { name: '所属商城' }), 'mall:verified-1');
    await user.click(screen.getByText('更多条件'));
    await user.type(screen.getByLabelText('起始时间'), '2026-08-01T09:30');
    await user.type(screen.getByLabelText('结束时间'), '2026-08-31T18:00');
    await user.type(screen.getByLabelText('来源渠道'), '京东企业购');
    await user.type(screen.getByLabelText('商品'), '办公用品组合');
    await user.type(screen.getByLabelText('成员'), '王小明');
    await user.type(screen.getByLabelText('最低金额（分）'), '100');
    await user.type(screen.getByLabelText('最高金额（分）'), '99900');
    await user.click(screen.getByRole('button', { name: '筛选订单' }));

    await waitFor(() =>
      expect(
        getRequests.some(
          (url) =>
            url.searchParams.get('view') === 'unpaid' &&
            url.searchParams.get('placed') === '7days' &&
            url.searchParams.get('lifecycle') === 'paid' &&
            url.searchParams.get('payment') === 'paid' &&
            url.searchParams.get('fulfillment') === 'allocated' &&
            url.searchParams.get('mall') === 'mall:verified-1' &&
            url.searchParams.has('from') &&
            url.searchParams.has('to') &&
            url.searchParams.get('channel') === '京东企业购' &&
            url.searchParams.get('product') === '办公用品组合' &&
            url.searchParams.get('member') === '王小明' &&
            url.searchParams.get('minimumMinor') === '100' &&
            url.searchParams.get('maximumMinor') === '99900'
        )
      ).toBe(true)
    );
    expect(currentParams().get('from')).toBe('2026-08-01T09:30');
    expect(currentParams().get('to')).toBe('2026-08-31T18:00');
  });

  it('reads the authoritative aftersale model for the console scope instead of filtering order rows in the browser', async () => {
    const user = userEvent.setup();
    renderRoute('/orders?campaign=keep');
    await screen.findByRole('table', { name: '订单列表' });

    const tab = screen.getByRole<HTMLButtonElement>('button', { name: '售后与退款' });
    expect(tab.disabled).toBe(false);
    await user.click(tab);

    expect(await screen.findByRole('table', { name: '售后订单列表' })).toBeTruthy();
    expect(screen.getByText(/^售后单 \d{4} \d{4}$/)).toBeTruthy();
    expect(screen.getByText(order.order_number)).toBeTruthy();
    expect(screen.getByText(/^内部订单 \d{4} \d{4}$/)).toBeTruthy();
    expect(screen.queryByText('aftersale:verified-1')).toBeNull();
    expect(screen.getByText('运输破损')).toBeTruthy();
    expect(screen.getByText('外包装破损')).toBeTruthy();
    expect(screen.getByText('需要退货')).toBeTruthy();
    expect(currentParams().get('view')).toBe('aftersale');
    expect(currentParams().get('campaign')).toBe('keep');
    const read = getRequests.find((url) => url.pathname.endsWith('/api/v1/orders/aftersales'));
    expect(read?.searchParams.get('limit')).toBe('50');
    expect(read?.searchParams.has('order')).toBe(false);
  });

  it('opens the React Aria dialog from both the explicit view action and the row using the internal ID in the URL', async () => {
    const user = userEvent.setup();
    renderRoute('/orders?campaign=keep');
    await screen.findByRole('table', { name: '订单列表' });

    await user.click(screen.getByRole('button', { name: `查看订单 ${order.order_number}` }));
    expect(await screen.findByRole('dialog', { name: new RegExp(order.order_number) })).toBeTruthy();
    expect(currentParams().get('selected')).toBe(order.id);
    expect(currentParams().get('campaign')).toBe('keep');
    expect(getRequests.some((url) => url.pathname.endsWith(`/api/v1/orders/${encodeURIComponent(order.id)}`))).toBe(true);

    await user.click(screen.getByRole('button', { name: '关闭订单详情' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(currentParams().get('selected')).toBeNull();

    const row = screen.getByRole('row', { name: new RegExp(order.order_number) });
    row.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: new RegExp(order.order_number) })).toBeTruthy();
    expect(currentParams().get('selected')).toBe(order.id);
  });

  it('opens the complete deep-link detail from the quick drawer', async () => {
    const user = userEvent.setup();
    renderRoute(`/scopes/enterprise/enterprise%3A1/orders?selected=${encodeURIComponent(order.id)}&campaign=keep`);
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    await user.click(within(dialog).getByRole('button', { name: '打开完整详情' }));
    await waitFor(() => expect(screen.getByTestId('order-location').textContent).toBe(`/scopes/enterprise/enterprise%3A1/orders/${encodeURIComponent(order.id)}`));
  });

  it('supports all seven drawer tabs by keyboard and click, then closes without losing unrelated URL state', async () => {
    const user = userEvent.setup();
    renderRoute(`/orders?selected=${encodeURIComponent(order.id)}&campaign=keep`);
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    const overview = within(dialog).getByRole('tab', { name: '订单概览' });
    const products = within(dialog).getByRole('tab', { name: '商品与履约' });
    const payment = within(dialog).getByRole('tab', { name: '支付与退款' });
    const aftersale = within(dialog).getByRole('tab', { name: '售后' });
    const finance = within(dialog).getByRole('tab', { name: '财务核对' });
    const support = within(dialog).getByRole('tab', { name: '客服工单' });
    const operations = within(dialog).getByRole('tab', { name: '操作记录' });
    expect([overview, products, payment, aftersale, finance, support, operations]).toHaveLength(7);
    expect(overview.getAttribute('aria-selected')).toBe('true');

    overview.focus();
    await user.keyboard('{ArrowRight}{Enter}');
    await waitFor(() => expect(products.getAttribute('aria-selected')).toBe('true'));
    expect(within(dialog).getByRole('heading', { name: '商品快照' })).toBeTruthy();
    expect(currentParams().get('tab')).toBe('products');

    await user.click(payment);
    expect(within(dialog).getByRole('heading', { name: '支付汇总' })).toBeTruthy();
    await user.click(aftersale);
    expect(within(dialog).getByRole('heading', { name: '售后汇总' })).toBeTruthy();
    await user.click(finance);
    expect(within(dialog).getByRole('heading', { name: '订单财务核对' })).toBeTruthy();
    await user.click(support);
    expect(within(dialog).getByRole('heading', { name: '关联客服工单' })).toBeTruthy();
    await user.click(operations);
    expect(within(dialog).getByRole('heading', { name: '写操作审计时间线' })).toBeTruthy();
    await user.click(overview);
    expect(within(dialog).getByRole('heading', { name: '金额与支付' })).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: '关闭订单详情' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(currentParams().get('selected')).toBeNull();
    expect(currentParams().get('tab')).toBeNull();
    expect(currentParams().get('campaign')).toBe('keep');
  });

  it('loads the permission-gated support panel independently with an exact order reference', async () => {
    server.use(
      http.get('*/api/v1/support/cases', ({ request }) => {
        getRequests.push(new URL(request.url));
        return HttpResponse.json({
          items: [
            {
              id: 'case:one',
              scope_id: 'enterprise:1',
              priority: 'high',
              state: 'assigned',
              assigned_agent_id: 'agent:one',
              response_due_at: '2026-09-05T02:00:00.000Z',
              resolution_due_at: '2026-09-05T08:00:00.000Z',
              created_at: '2026-09-05T01:00:00.000Z',
              updated_at: '2026-09-05T01:30:00.000Z',
              version: 1,
              conversation_id: 'conversation:one',
              skill: 'order',
              member_id: 'member:verified-1',
              order_id: order.id,
              channel: 'inapp',
              subject: '物流进度咨询',
              reference_type: null,
              reference_id: null,
              unread_count: 2,
              sla_risk: 'risk',
            },
          ],
          count: 1,
        });
      })
    );
    const permitted = { ...context, session: { ...context.session, permissions: [...context.session.permissions, 'support.case.read'], capabilities: [...context.session.capabilities, 'support.cases.read'] } };
    renderRoute(`/orders?selected=${encodeURIComponent(order.id)}&tab=support`, permitted);

    expect(await screen.findByText('物流进度咨询')).toBeTruthy();
    const request = getRequests.find((url) => url.pathname === '/api/v1/support/cases');
    expect(request?.searchParams.get('orderId')).toBe(order.id);
    expect(request?.searchParams.get('keyword')).toBeNull();
  });

  it('restores the selected order and detail tab from the initial URL', async () => {
    renderRoute(`/orders?selected=${encodeURIComponent(order.id)}&tab=payment&campaign=restore`);
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });

    expect(within(dialog).getByRole('tab', { name: '支付与退款' }).getAttribute('aria-selected')).toBe('true');
    expect(within(dialog).getByRole('heading', { name: '支付汇总' })).toBeTruthy();
    expect(currentParams().get('selected')).toBe(order.id);
    expect(currentParams().get('tab')).toBe('payment');
    expect(currentParams().get('campaign')).toBe('restore');
  });

  it('refreshes the current server-backed list', async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole('table', { name: '订单列表' });
    await waitFor(() => expect(orderRequestCount('50')).toBe(1));

    await user.click(screen.getByRole('button', { name: '刷新数据' }));
    await waitFor(() => expect(orderRequestCount('50')).toBe(2));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '刷新数据' }).disabled).toBe(false);
  });

  it('renders the empty state', async () => {
    server.use(http.get('*/api/v1/orders', () => HttpResponse.json({ items: [], count: 0, facets: emptyFacets })));
    renderRoute();

    expect(await screen.findByText('暂无符合条件的订单')).toBeTruthy();
    expect(screen.getByText('请调整服务端筛选条件后重试。')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '订单列表' })).toBeNull();
    expect(screen.getByText('第 1 页 · 本页 0 条')).toBeTruthy();
  });

  it('renders a read error and retries it without inventing stale data', async () => {
    let attempts = 0;
    server.use(
      http.get('*/api/v1/orders', () => {
        attempts += 1;
        return attempts === 1 ? HttpResponse.json({ code: 'ORDER_READ_DENIED', requestId: 'request:failed' }, { status: 403 }) : HttpResponse.json(listPage);
      })
    );
    const user = userEvent.setup();
    renderRoute();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('订单读取失败')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '订单列表' })).toBeNull();
    await user.click(within(alert).getByRole('button', { name: '重试' }));
    expect(await screen.findByRole('table', { name: '订单列表' })).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it('keeps the order list usable when only status facets and watermarks are unavailable', async () => {
    server.use(
      http.get('*/api/v1/orders', () => HttpResponse.json({ ...listPage, facets: { state: 'unavailable', error: { code: 'ORDER_FACET_UNAVAILABLE', message: '订单状态统计与数据水位暂时不可用，列表仍可继续使用。', retryable: true } } }))
    );
    renderRoute();

    expect(await screen.findByRole('table', { name: '订单列表' })).toBeTruthy();
    expect(screen.getByText('订单状态统计与数据水位暂时不可用，列表仍可继续使用。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试统计' })).toBeTruthy();
  });

  it('surfaces exception counts before the ordinary list and opens the server-filtered workbench', async () => {
    server.use(
      http.get('*/api/v1/orders', ({ request }) => {
        getRequests.push(new URL(request.url));
        return HttpResponse.json({ ...listPage, facets: { ...listPage.facets, data: { ...listPage.facets.data, counts: { ...listPage.facets.data.counts, exception: 2 } } } });
      })
    );
    const user = userEvent.setup();
    renderRoute();

    expect(await screen.findByText('发现 2 条支付、履约、售后或来源核验异常。')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '优先处理异常' }));
    await waitFor(() => expect(currentParams().get('view')).toBe('exception'));
    expect(await screen.findByRole('region', { name: '订单异常工作台' })).toBeTruthy();
    await waitFor(() => expect(getRequests.some((url) => url.searchParams.get('view') === 'exception')).toBe(true));
  });

  it('organizes authoritative exception and channel recovery facts without preview-only inference', async () => {
    const paymentFailed = { ...order, id: 'order:payment-failed', order_number: 'SW202609070001', payment_state: 'failed', updated_at: '2026-09-07T01:00:00.000Z' } as const;
    const fulfillmentReturned = { ...order, id: 'order:fulfillment-returned', order_number: 'SW202609070002', fulfillment_state: 'returned', updated_at: '2026-09-07T02:00:00.000Z' } as const;
    const aftersaleReviewing = { ...order, id: 'order:aftersale-reviewing', order_number: 'SW202609070003', aftersale_state: 'reviewing', updated_at: '2026-09-07T03:00:00.000Z' } as const;
    const sourcePending = { ...order, id: 'order:source-pending', order_number: 'SW202609070004', updated_at: '2026-09-07T04:00:00.000Z' } as const;
    const recovery = {
      id: 'recovery:exception-one',
      order_id: paymentFailed.id,
      order_number: paymentFailed.order_number,
      resource_type: 'intent',
      resource_id: 'intent:exception-one',
      severity: 'critical',
      state: 'open',
      error_code: 'PAYMENT_LATE_SUCCESS',
      evidence: {},
      occurrence_count: 2,
      opened_at: '2026-09-07T04:30:00.000Z',
      resolved_at: null,
      resolution_request_id: null,
      version: 3,
    } as const;
    server.use(
      http.get('*/api/v1/orders', ({ request }) => {
        getRequests.push(new URL(request.url));
        return HttpResponse.json({
          items: [paymentFailed, fulfillmentReturned, aftersaleReviewing, sourcePending],
          count: 4,
          facets: { ...listPage.facets, data: { ...listPage.facets.data, counts: { ...listPage.facets.data.counts, exception: 4 } } },
        });
      }),
      http.get('*/api/v1/payments/recoveries', () => HttpResponse.json({ items: [recovery], count: 1 })),
      http.get('*/api/v1/orders/:orderId', ({ params }) =>
        HttpResponse.json({ ...detail, summary: { ...detail.summary, id: String(params.orderId), orderNumber: paymentFailed.order_number, paymentState: 'failed', updatedAt: paymentFailed.updated_at } })
      )
    );
    const permitted = { ...context, session: { ...context.session, permissions: [...context.session.permissions, 'payment.recovery.read'], capabilities: [...context.session.capabilities, 'payment.recoveries.read'] } };
    const user = userEvent.setup();
    renderRoute('/orders?view=exception', permitted);

    const workbench = await screen.findByRole('region', { name: '订单异常工作台' });
    expect(within(workbench).getByRole('heading', { name: '先确认真实异常，再进入对应分区恢复' })).toBeTruthy();
    expect(within(workbench).getByRole('list', { name: '异常处理步骤' }).textContent).toContain('1找到异常2核对权威事实3进入恢复分区');
    expect(within(workbench).getByRole('region', { name: '异常概览' }).textContent).toContain('异常订单4');
    expect(within(workbench).getByText('订单取消后支付成功 · 已出现 2 次 · 待处理')).toBeTruthy();
    expect(within(workbench).queryByText('PAYMENT_LATE_SUCCESS')).toBeNull();
    expect(within(workbench).getAllByText('支付失败').length).toBeGreaterThan(0);
    expect(within(workbench).getAllByText('履约异常').length).toBeGreaterThan(0);
    expect(within(workbench).getByText('售后待审核')).toBeTruthy();

    await user.click(within(workbench).getByRole('button', { name: '渠道核验' }));
    expect(within(workbench).getByRole('listbox', { name: '异常订单队列' }).textContent).toContain(sourcePending.order_number);
    expect(within(workbench).getByText('服务端异常条件已识别')).toBeTruthy();
    await user.click(within(workbench).getByRole('button', { name: '全部异常' }));
    await user.click(within(workbench).getByRole('button', { name: '进入支付分区' }));
    await waitFor(() => {
      expect(currentParams().get('selected')).toBe(paymentFailed.id);
      expect(currentParams().get('tab')).toBe('payment');
    });
  });

  it('keeps payment recovery reads locked in the exception workbench until MFA assurance is available', async () => {
    let recoveryReads = 0;
    server.use(
      http.get('*/api/v1/payments/recoveries', () => {
        recoveryReads += 1;
        return HttpResponse.json({ items: [], count: 0 });
      })
    );
    const lowAssurance = {
      ...context,
      session: {
        ...context.session,
        permissions: [...context.session.permissions, 'payment.recovery.read'],
        capabilities: [...context.session.capabilities, 'payment.recoveries.read'],
        assurance: { level: 1 as const, verified: context.session.assurance.verified },
      },
    };
    renderRoute('/orders?view=exception', lowAssurance);

    const workbench = await screen.findByRole('region', { name: '订单异常工作台' });
    expect(within(workbench).getByText('完成二次验证后查看支付恢复事项')).toBeTruthy();
    expect(within(workbench).getByRole('button', { name: '完成二次验证' })).toBeTruthy();
    await waitFor(() => expect(recoveryReads).toBe(0));
  });

  it('loads detail payment recoveries automatically after MFA assurance succeeds', async () => {
    let recoveryReads = 0;
    server.use(
      http.get('*/api/v1/payments/recoveries', () => {
        recoveryReads += 1;
        return HttpResponse.json({ items: [], count: 0 });
      })
    );
    const lowAssurance = {
      ...context,
      session: {
        ...context.session,
        permissions: [...context.session.permissions, 'payment.recovery.read'],
        capabilities: [...context.session.capabilities, 'payment.recoveries.read'],
        assurance: { level: 1 as const, verified: context.session.assurance.verified },
      },
    };
    const rendered = renderRoute(`/orders?selected=${encodeURIComponent(order.id)}&tab=payment`, lowAssurance);

    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    expect(within(dialog).getByText('完成二次验证后查看')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '完成二次验证' })).toBeTruthy();
    await waitFor(() => expect(recoveryReads).toBe(0));

    rendered.rerenderContext({
      ...lowAssurance,
      session: { ...lowAssurance.session, assurance: { level: 2, verified: '2026-08-26T08:05:00.000Z' } },
    });
    expect(await within(dialog).findByText('本单没有支付恢复事项。')).toBeTruthy();
    expect(recoveryReads).toBe(1);
  });

  it('configures optional columns without exposing unsupported bulk selection', async () => {
    const user = userEvent.setup();
    const rendered = renderRoute();
    await screen.findByRole('table', { name: '订单列表' });

    expect(screen.queryByRole('checkbox', { name: `选择订单 ${order.order_number}` })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(currentParams().get('selected')).toBeNull();

    await user.click(screen.getByRole('button', { name: '列设置' }));
    const settings = screen.getByRole('region', { name: '订单列表列设置' });
    const productColumn = within(settings).getByRole<HTMLInputElement>('checkbox', { name: '商品摘要' });
    expect(productColumn.checked).toBe(true);
    await user.click(productColumn);
    expect(screen.queryByRole('columnheader', { name: '商品摘要' })).toBeNull();
    await user.click(within(settings).getByRole('button', { name: '完成' }));
    expect(screen.queryByRole('region', { name: '订单列表列设置' })).toBeNull();
    const stored = window.localStorage.getItem('zhudatuan.console.preferences');
    expect(stored).toContain('orders');
    expect(stored).not.toContain('product');
    rendered.unmount();
    renderRoute();
    await screen.findByRole('table', { name: '订单列表' });
    expect(screen.queryByRole('columnheader', { name: '商品摘要' })).toBeNull();
  });

  it('clears cursor on filter submit while preserving unrelated URL parameters', async () => {
    const user = userEvent.setup();
    renderRoute('/orders?cursor=cursor%3Aold&campaign=keep');
    await screen.findByRole('table', { name: '订单列表' });

    const input = screen.getByRole('textbox', { name: '订单搜索' });
    await user.clear(input);
    await user.type(input, 'order:searched');
    await user.click(screen.getByRole('button', { name: '筛选订单' }));

    await waitFor(() => expect(currentParams().get('search')).toBe('order:searched'));
    expect(currentParams().get('cursor')).toBeNull();
    expect(currentParams().get('campaign')).toBe('keep');
    await waitFor(() => expect(getRequests.some((url) => url.searchParams.get('limit') === '50' && url.searchParams.get('search') === 'order:searched' && !url.searchParams.has('cursor'))).toBe(true));
  });

  it('stores cursor position in the URL and restores the previous page without offset pagination', async () => {
    server.use(
      http.get('*/api/v1/orders', ({ request }) => {
        const url = new URL(request.url);
        getRequests.push(url);
        return HttpResponse.json(url.searchParams.has('cursor') ? { ...listPage, nextCursor: undefined } : listPage);
      })
    );
    const user = userEvent.setup();
    renderRoute('/orders?campaign=keep');
    await screen.findByRole('table', { name: '订单列表' });

    await user.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(currentParams().get('cursor')).toBe('cursor:next'));
    expect(currentParams().get('page')).toBe('2');
    expect(currentParams().get('campaign')).toBe('keep');
    expect(screen.getByText('第 2 页 · 本页 1 条')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '上一页' }));
    await waitFor(() => expect(currentParams().get('cursor')).toBeNull());
    expect(currentParams().get('page')).toBeNull();
    expect(currentParams().get('campaign')).toBe('keep');
  });

  it('keeps the last verified page visible while a changed URL query revalidates', async () => {
    const replacement = { ...order, id: 'order:internal-2', order_number: 'SW202608260002' };
    server.use(
      http.get('*/api/v1/orders', async ({ request }) => {
        const url = new URL(request.url);
        getRequests.push(url);
        if (url.searchParams.get('search') === '新订单') {
          await delay(80);
          return HttpResponse.json({ ...listPage, items: [replacement], nextCursor: undefined });
        }
        return HttpResponse.json(listPage);
      })
    );
    const user = userEvent.setup();
    renderRoute();
    await screen.findByText(order.order_number);

    await user.type(screen.getByRole('textbox', { name: '订单搜索' }), '新订单');
    await user.click(screen.getByRole('button', { name: '筛选订单' }));
    expect(screen.getByText(order.order_number)).toBeTruthy();
    expect(document.getElementById('orderlistpanel')?.getAttribute('aria-busy')).toBe('true');
    expect(await screen.findByText(replacement.order_number)).toBeTruthy();
    expect(screen.queryByText(order.order_number)).toBeNull();
  });

  it('exposes only production-backed order actions and no preview placeholders', async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole('table', { name: '订单列表' });

    expect(screen.getByRole('button', { name: '导出订单' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '导入外部订单' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: `订单 ${order.order_number} 更多操作` })).toBeNull();

    await user.click(screen.getByRole('button', { name: `查看订单 ${order.order_number}` }));
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    expect(within(dialog).queryByRole('button', { name: '更多' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: '确认发货' })).toBeNull();
    expect(document.body.textContent).not.toContain('本地交互预览');
    expect(document.body.textContent).not.toContain('不会发起写操作');
    expect(document.body.textContent).not.toContain('即将开放');
  });

  it('keeps unavailable header actions visible with a Chinese permission reason', async () => {
    const denied = { ...context, session: { ...context.session, permissions: [], capabilities: [] } };
    renderRoute('/orders', denied);
    await screen.findByRole('table', { name: '订单列表' });

    const importing = screen.getByRole<HTMLButtonElement>('button', { name: '导入外部订单' });
    const exporting = screen.getByRole<HTMLButtonElement>('button', { name: '导出订单' });
    expect(importing.disabled).toBe(true);
    expect(importing.title).toContain('没有导入外部订单权限');
    expect(exporting.disabled).toBe(true);
    expect(exporting.title).toContain('没有导出订单权限');
  });

  it('keeps the detail usable when one authoritative section is unavailable', async () => {
    server.use(
      http.get('*/api/v1/orders/:orderId', () =>
        HttpResponse.json({ ...detail, payment: { state: 'unavailable', error: { code: 'PAYMENT_PROJECTION_DELAYED', message: '支付投影正在追赶，请稍后重试。', retryable: true, traceId: 'trace:payment-1' } } })
      )
    );
    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('button', { name: `查看订单 ${order.order_number}` }));
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    expect(within(dialog).getByText('支付快照暂时不可用')).toBeTruthy();
    expect(within(dialog).getByText('权威商品标题')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '仅重试此分区' })).toBeTruthy();
  });

  it('keeps the aggregate list and exception navigation usable when the entire detail request fails', async () => {
    server.use(http.get('*/api/v1/orders/:orderId', () => HttpResponse.json({ code: 'DEPENDENCY_UNAVAILABLE', requestId: 'request:detail-failed' }, { status: 503 })));
    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('button', { name: `查看订单 ${order.order_number}` }));

    const dialog = await screen.findByRole('dialog', { name: /订单详情/ });
    expect(await within(dialog).findByText('订单详情读取失败')).toBeTruthy();
    expect(within(dialog).getByText(/^请求追踪号：\S+$/)).toBeTruthy();
    expect(screen.getByRole('table', { name: '订单列表', hidden: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: '异常订单', hidden: true })).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('table', { name: '订单列表' })).toBeTruthy();
  });

  it('creates frozen exports and controlled external-order import tasks', async () => {
    let exportBody: unknown;
    let importBody: unknown;
    let exportRequests = 0;
    server.use(
      http.post('*/api/v1/orders/exports', async ({ request }) => {
        exportRequests += 1;
        exportBody = await request.json();
        await delay(60);
        return HttpResponse.json({
          id: 'export:order-1',
          scope: 'enterprise:1',
          report: 'orders',
          filter: {},
          watermark: '2026-09-05T01:00:00.000Z',
          state: 'queued',
          cursor: null,
          recordCount: 0,
          objectReference: null,
          objectHash: null,
          objectSize: null,
          scanState: null,
          expiresAt: null,
          createdAt: '2026-09-05T01:00:00.000Z',
          generatedAt: null,
        });
      }),
      http.post('*/api/v1/runtime/uploads', async ({ request }) => {
        expect(await request.json()).toEqual({
          name: 'orders.csv',
          contentType: 'text/csv',
          size: 31,
          sha256: 'fa4283028ec30cd13148a0283bd7d56c40e4c604069f57b07604a490bcb1e040',
        });
        return HttpResponse.json({
          reference: 'object:orders/file.csv',
          path: 'imports/orders.csv',
          sha256: 'fa4283028ec30cd13148a0283bd7d56c40e4c604069f57b07604a490bcb1e040',
          size: 31,
          contentType: 'text/csv',
          retentionUntil: '2099-09-05T00:00:00.000Z',
          upload: { url: 'https://objects.test/imports/orders.csv', method: 'PUT', headers: { 'content-type': 'text/csv' }, expiresAt: '2099-09-05T00:00:00.000Z' },
        });
      }),
      http.put('https://objects.test/imports/orders.csv', ({ request }) => {
        expect(request.credentials).toBe('omit');
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('*/api/v1/orders/imports', async ({ request }) => {
        importBody = await request.json();
        return HttpResponse.json({ id: 'import:order-1', state: 'uploaded', total_count: 0, cursor_value: 0, success_count: 0, failure_count: 0, created_at: '2026-09-05T01:00:00.000Z', updated_at: '2026-09-05T01:00:00.000Z' });
      })
    );
    const user = userEvent.setup();
    renderRoute('/orders?search=SW2026&channel=channel%3Ajd');
    await screen.findByRole('table', { name: '订单列表' });
    await user.click(screen.getByRole('button', { name: '导出订单' }));
    const exportDialog = screen.getByRole('dialog', { name: /安全导出订单/ });
    expect(within(exportDialog).getByRole<HTMLButtonElement>('button', { name: '创建安全导出' }).disabled).toBe(true);
    await user.click(within(exportDialog).getByRole('checkbox'));
    expect(within(exportDialog).getByRole<HTMLButtonElement>('button', { name: '创建安全导出' }).disabled).toBe(false);
    await user.dblClick(within(exportDialog).getByRole('button', { name: '创建安全导出' }));
    expect(await within(exportDialog).findByText('导出任务已进入安全队列')).toBeTruthy();
    expect(exportRequests).toBe(1);
    expect(exportBody).toEqual({ search: 'SW2026', channel: 'channel:jd' });
    await user.click(within(exportDialog).getByRole('button', { name: '完成' }));

    await user.click(screen.getByRole('button', { name: '导入外部订单' }));
    let importDialog = screen.getByRole('dialog', { name: /导入外部订单/ });
    expect(within(importDialog).getByText('外部订单标准模板')).toBeTruthy();
    await user.click(within(importDialog).getByRole('button', { name: '下一步：上传文件' }));
    importDialog = screen.getByRole('dialog', { name: /导入外部订单/ });
    const file = within(importDialog).getByLabelText<HTMLInputElement>('选择外部订单文件');
    await user.upload(file, streamingFile('external_order_no,amount_minor\n', 'orders.csv', 'text/csv'));
    expect(typeof file.files?.[0]?.stream).toBe('function');
    await user.click(within(importDialog).getByRole('button', { name: '下一步：核对映射' }));
    expect(within(importDialog).getByText('标准列自动映射')).toBeTruthy();
    expect(within(importDialog).getByText('重复项处理')).toBeTruthy();
    const confirmation = within(importDialog).getByRole<HTMLInputElement>('checkbox');
    await user.click(confirmation);
    expect(confirmation.checked).toBe(true);
    const submit = within(importDialog).getByRole<HTMLButtonElement>('button', { name: '提交并开始服务端预检' });
    expect(submit.disabled).toBe(false);
    expect(submit.form?.checkValidity()).toBe(true);
    await user.click(submit);
    expect(await within(importDialog).findByText('预检任务已创建')).toBeTruthy();
    expect(importBody).toEqual({ objectRef: 'object:orders/file.csv', sha256: 'fa4283028ec30cd13148a0283bd7d56c40e4c604069f57b07604a490bcb1e040', fileName: 'orders.csv' });
    await user.click(within(importDialog).getByRole('button', { name: '查看预检、确认与任务收据' }));
    await waitFor(() => expect(screen.getByTestId('order-location').textContent).toBe('/scopes/enterprise/enterprise%3A1/imports/order/import%3Aorder-1'));
  });

  it('executes reminder, receipt and aftersale decisions through real operation routes', async () => {
    const calls: string[] = [];
    server.use(
      http.get('*/api/v1/orders/aftersales', () => HttpResponse.json({ items: [aftersale], count: 1, availableLines: [] })),
      http.get('*/api/v1/orders/:orderId', () => HttpResponse.json({ ...detail, summary: { ...detail.summary, lifecycleState: 'shipped', fulfillmentState: 'shipped' } })),
      http.post('*/api/v1/orders/:orderId/reminders', ({ params }) => {
        calls.push(`remind:${parameter(params.orderId)}`);
        return HttpResponse.json({ id: 'reminder:1', order_id: order.id, member_id: 'member:1', kind: 'fulfillment', state: 'queued', created_at: '2026-09-05T01:00:00.000Z' });
      }),
      http.post('*/api/v1/orders/:orderId/receive', ({ params }) => {
        calls.push(`receive:${parameter(params.orderId)}`);
        return HttpResponse.json({ orderId: order.id, fulfillmentState: 'received', receivedAt: '2026-09-05T01:00:00.000Z', version: 12, eventId: 'event:receive-1', repeated: false });
      }),
      http.put('*/api/v1/orders/aftersales/:aftersaleId/approval', ({ params }) => {
        calls.push(`approve:${parameter(params.aftersaleId)}`);
        return HttpResponse.json({ id: aftersale.id, orderId: order.id, state: 'approved', version: 3, updatedAt: '2026-09-05T01:00:00.000Z' });
      }),
      http.delete('*/api/v1/orders/aftersales/:aftersaleId/approval', ({ params }) => {
        calls.push(`reject:${parameter(params.aftersaleId)}`);
        return HttpResponse.json({ id: aftersale.id, orderId: order.id, state: 'rejected', version: 3, updatedAt: '2026-09-05T01:00:00.000Z' });
      })
    );
    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('button', { name: `查看订单 ${order.order_number}` }));
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    await user.click(within(dialog).getByRole('button', { name: '提醒履约' }));
    let action = screen.getByRole('dialog', { name: /提醒履约方处理/ });
    await user.click(within(action).getByRole('checkbox'));
    await user.click(within(action).getByRole('button', { name: '发送提醒' }));
    expect(await within(action).findByText('履约提醒已排队')).toBeTruthy();
    await user.click(within(action).getByRole('button', { name: '完成' }));
    await user.click(within(dialog).getByRole('button', { name: '确认收货' }));
    action = screen.getByRole('dialog', { name: /确认订单收货/ });
    await user.type(within(action).getByLabelText('确认依据'), '已核对签收回执');
    await user.click(within(action).getByRole('checkbox'));
    await user.click(within(action).getByRole('button', { name: '确认收货' }));
    expect(await within(action).findByText('订单已确认收货')).toBeTruthy();
    await user.click(within(action).getByRole('button', { name: '完成' }));
    await user.click(within(dialog).getByRole('button', { name: '关闭订单详情' }));

    await user.click(screen.getByRole('button', { name: '售后与退款' }));
    await user.click(await screen.findByRole('button', { name: '批准' }));
    action = screen.getByRole('dialog', { name: /批准售后申请/ });
    await user.type(within(action).getByLabelText('审核依据'), '附件和退款金额核对无误');
    await user.click(within(action).getByRole('checkbox'));
    await user.click(within(action).getByRole('button', { name: '批准并继续处理' }));
    expect(await within(action).findByText('售后决策已生效')).toBeTruthy();
    expect(within(action).getByText(/已进入“已通过”状态/)).toBeTruthy();
    await user.click(within(action).getByRole('button', { name: '完成' }));
    await user.click(await screen.findByRole('button', { name: '拒绝' }));
    action = screen.getByRole('dialog', { name: /拒绝售后申请/ });
    await user.type(within(action).getByLabelText('审核依据'), '申请范围与订单事实不一致');
    await user.click(within(action).getByRole('checkbox'));
    await user.click(within(action).getByRole('button', { name: '拒绝申请' }));
    expect(await within(action).findByText(/已进入“已拒绝”状态/)).toBeTruthy();
    expect(calls).toEqual([`remind:${order.id}`, `receive:${order.id}`, `approve:${aftersale.id}`, `reject:${aftersale.id}`]);
  });

  it('executes shipment, refund and payment recovery from independently permissioned detail panels', async () => {
    const calls: string[] = [];
    const recovery = {
      id: 'recovery:one',
      order_id: order.id,
      order_number: order.order_number,
      resource_type: 'intent',
      resource_id: 'intent:one',
      severity: 'critical',
      state: 'open',
      error_code: 'PAYMENT_LATE_SUCCESS',
      evidence: {},
      occurrence_count: 2,
      opened_at: '2026-09-05T01:00:00.000Z',
      resolved_at: null,
      resolution_request_id: null,
      version: 3,
    };
    server.use(
      http.get('*/api/v1/payments/recoveries', () => HttpResponse.json({ items: [recovery], count: 1 })),
      http.post('*/api/v1/fulfillments/:fulfillmentId/shipments', ({ params }) => {
        const fulfillment = parameter(params.fulfillmentId);
        calls.push(`ship:${fulfillment}`);
        return HttpResponse.json(
          {
            id: fulfillment,
            order_id: order.id,
            suborder_id: 'suborder:one',
            provider: null,
            partner_id: null,
            store_id: null,
            kind: 'shipment',
            route: 'physical',
            state: 'processing',
            external_reference: null,
            payment_id: order.payment.paymentId,
            source_effect_id: null,
            amount_minor: order.total_minor,
            idempotency_key: null,
            created_at: '2026-09-05T01:00:00.000Z',
            updated_at: '2026-09-05T01:00:00.000Z',
            version: 1,
            shipment_id: 'shipment:one',
            package_id: 'package:one',
            tracking: 'SF123456',
            shipped_quantity: 2,
          },
          { status: 201 }
        );
      }),
      http.post('*/api/v1/payments/refunds', () => {
        calls.push('refund');
        return HttpResponse.json(
          { id: 'refund:one', payment_id: order.payment.paymentId, provider: 'wechat', provider_reference: 'refund:one', amount_minor: 1000, currency: 'CNY', state: 'requested', reason: '订单差额退回', aftersale_id: null },
          { status: 202 }
        );
      }),
      http.post('*/api/v1/payments/recoveries/:recoveryId/resolutions', ({ params }) => {
        const recoveryId = parameter(params.recoveryId);
        calls.push(`recovery:${recoveryId}`);
        return HttpResponse.json({ case: recoveryId, request: 'recoveryrequest:one', action: 'requery', state: 'accepted' }, { status: 202 });
      })
    );
    const permitted = {
      ...context,
      session: {
        ...context.session,
        permissions: [...context.session.permissions, 'fulfillment.ship', 'payment.refund', 'payment.recovery.read', 'payment.recovery.manage'],
        capabilities: [...context.session.capabilities, 'fulfillment.shipments.create', 'payment.refunds.request', 'payment.recoveries.read', 'payment.recoveries.resolve'],
      },
    };
    const user = userEvent.setup();
    renderRoute(`/orders?selected=${encodeURIComponent(order.id)}&tab=products`, permitted);
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });

    await user.click(within(dialog).getByRole('button', { name: '登记发货' }));
    let action = screen.getByRole('dialog', { name: /登记订单发货/ });
    await user.type(within(action).getByLabelText('物流单号'), 'SF123456');
    await user.type(within(action).getByLabelText('承运方（选填）'), '顺丰');
    await user.click(within(action).getByRole('checkbox'));
    await user.click(within(action).getByRole('button', { name: '登记发货' }));
    expect(await within(action).findByText('发货事实已登记')).toBeTruthy();
    await user.click(within(action).getByRole('button', { name: '完成' }));

    await user.click(within(dialog).getByRole('tab', { name: '支付与退款' }));
    await user.click(within(dialog).getByRole('button', { name: '提交退款' }));
    action = screen.getByRole('dialog', { name: /提交订单退款/ });
    const amount = within(action).getByLabelText('退款金额（元）');
    await user.clear(amount);
    await user.type(amount, '10.00');
    await user.type(within(action).getByLabelText('退款依据'), '订单差额退回');
    await user.type(within(action).getByLabelText('一次性复核凭证'), 'p'.repeat(43));
    await user.click(within(action).getByRole('checkbox'));
    await user.click(within(action).getByRole('button', { name: '提交退款' }));
    expect(await within(action).findByText('退款任务已受理')).toBeTruthy();
    await user.click(within(action).getByRole('button', { name: '完成' }));

    await user.click(await within(dialog).findByRole('button', { name: '处理恢复事项' }));
    action = screen.getByRole('dialog', { name: /处理支付恢复事项/ });
    await user.type(within(action).getByLabelText('处理依据'), '重新核对支付渠道结果');
    await user.type(within(action).getByLabelText('一次性复核凭证'), 'r'.repeat(43));
    await user.click(within(action).getByRole('checkbox'));
    await user.click(within(action).getByRole('button', { name: '提交恢复' }));
    expect(await within(action).findByText('恢复请求已受理')).toBeTruthy();
    expect(calls).toEqual([`ship:${order.fulfillments[0].id}`, 'refund', 'recovery:recovery:one']);
  });

  it('shows and executes cancellation only for an independently authorized unpaid order', async () => {
    const calls: string[] = [];
    const unpaidDetail = {
      ...detail,
      summary: { ...detail.summary, paymentState: 'unpaid', fulfillmentState: 'unallocated', lifecycleState: 'awaitingpayment' },
      payment: { state: 'ready', data: { ...order.payment, paymentId: null, capturedMinor: 0, refundableMinor: 0 } },
      fulfillment: { state: 'ready', data: [] },
    } as const;
    server.use(
      http.get('*/api/v1/orders/:orderId', () => HttpResponse.json(unpaidDetail)),
      http.post('*/api/v1/orders/:orderId/cancel', ({ params }) => {
        calls.push(`cancel:${parameter(params.orderId)}`);
        return HttpResponse.json({ orderId: order.id, lifecycleState: 'cancelled', fulfillmentState: 'cancelled', cancelledAt: '2026-09-05T02:00:00.000Z', version: 12, eventId: 'event:cancel-one', repeated: false });
      })
    );
    const permitted = { ...context, session: { ...context.session, permissions: [...context.session.permissions, 'order.cancel'], capabilities: [...context.session.capabilities, 'order.orders.cancel'] } };
    const user = userEvent.setup();
    renderRoute(`/orders?selected=${encodeURIComponent(order.id)}`, permitted);
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    await user.click(within(dialog).getByRole('button', { name: '取消订单' }));
    const action = screen.getByRole('dialog', { name: /取消待付款订单/ });
    await user.type(within(action).getByLabelText('取消原因'), '收货信息有误，需要重新下单');
    await user.click(within(action).getByRole('checkbox'));
    await user.click(within(action).getByRole('button', { name: '确认取消订单' }));
    expect(await within(action).findByText('订单已取消')).toBeTruthy();
    expect(calls).toEqual([`cancel:${order.id}`]);
  });

  it('executes return receipt and inspection from the authoritative aftersale return timeline', async () => {
    const calls: string[] = [];
    let returnState: 'authorized' | 'received' = 'authorized';
    let returnVersion = 4;
    const sale = () => ({
      ...aftersale,
      state: returnState === 'authorized' ? 'returning' : 'received',
      timeline: [
        ...aftersale.timeline,
        {
          sequence: 2,
          kind: 'return',
          previousState: 'approved',
          state: returnState === 'authorized' ? 'returning' : 'received',
          evidence: { returns: [{ id: 'return:one', state: returnState, provider: null, providerReference: null, trackingNumber: 'SF123456', version: returnVersion }] },
          occurredAt: '2026-09-05T01:00:00.000Z',
        },
      ],
    });
    server.use(
      http.get('*/api/v1/orders/aftersales', () => HttpResponse.json({ items: [sale()], count: 1, availableLines: [] })),
      http.put('*/api/v1/fulfillments/returns/:returnId/receipt', ({ params }) => {
        const returnId = parameter(params.returnId);
        calls.push(`receive:${returnId}`);
        returnState = 'received';
        returnVersion = 5;
        return HttpResponse.json({
          id: returnId,
          aftersale_id: aftersale.id,
          fulfillment_id: order.fulfillments[0].id,
          scope_id: order.scope_id,
          state: 'received',
          provider: null,
          provider_reference: null,
          instruction: {},
          tracking_number: 'SF123456',
          created_at: '2026-09-05T01:00:00.000Z',
          updated_at: '2026-09-05T01:01:00.000Z',
          version: 5,
          lines: [{ line: 'line:one', quantity: 1 }],
          inspections: [],
        });
      }),
      http.put('*/api/v1/fulfillments/returns/:returnId/inspection', ({ params }) => {
        const returnId = parameter(params.returnId);
        calls.push(`inspect:${returnId}`);
        return HttpResponse.json({
          id: returnId,
          aftersale_id: aftersale.id,
          fulfillment_id: order.fulfillments[0].id,
          scope_id: order.scope_id,
          state: 'accepted',
          provider: null,
          provider_reference: null,
          instruction: {},
          tracking_number: 'SF123456',
          created_at: '2026-09-05T01:00:00.000Z',
          updated_at: '2026-09-05T01:02:00.000Z',
          version: 6,
          lines: [{ line: 'line:one', quantity: 1 }],
          inspections: [{ id: 'inspection:one', sequence: 1, accepted: true, evidence: {}, actor: 'actor:one', inspectedAt: '2026-09-05T01:02:00.000Z' }],
        });
      })
    );
    const permitted = {
      ...context,
      session: { ...context.session, permissions: [...context.session.permissions, 'fulfillment.return.manage'], capabilities: [...context.session.capabilities, 'fulfillment.returns.receive', 'fulfillment.returns.inspect'] },
    };
    const user = userEvent.setup();
    renderRoute('/orders?view=aftersale', permitted);
    await user.click(await screen.findByRole('button', { name: '登记退货收货' }));
    let action = screen.getByRole('dialog', { name: /登记退货收货/ });
    await user.click(within(action).getByRole('checkbox'));
    await user.click(within(action).getByRole('button', { name: '确认退货收货' }));
    expect(await within(action).findByText('退货包裹已登记收货')).toBeTruthy();
    await user.click(within(action).getByRole('button', { name: '完成' }));
    await user.click(await screen.findByRole('button', { name: '登记质检' }));
    action = screen.getByRole('dialog', { name: /登记退货质检/ });
    await user.type(within(action).getByLabelText('质检依据'), '外观、数量和配件均已核对');
    await user.click(within(action).getByRole('checkbox'));
    await user.click(within(action).getByRole('button', { name: '提交质检结论' }));
    expect(await within(action).findByText('退货质检结论已登记')).toBeTruthy();
    expect(calls).toEqual(['receive:return:one', 'inspect:return:one']);
  });
});

function parameter(value: string | readonly string[] | undefined): string {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) return value[0];
  throw new Error('TEST_ROUTE_PARAMETER_MISSING');
}

function renderRoute(entry = '/orders', initialContext = context) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  const route = (value: ConsoleContext) => (
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={value}>
          <StepupProvider controller={{ request: () => undefined }}>
            <DependencyProvider value={createConsoleDependencies()}>
              <Component />
            </DependencyProvider>
          </StepupProvider>
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  const rendered = render(route(initialContext));
  return { ...rendered, rerenderContext: (value: ConsoleContext) => rendered.rerender(route(value)) };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="order-location">
      {location.pathname}
      {location.search}
    </output>
  );
}

function currentParams(): URLSearchParams {
  const value = screen.getByTestId('order-location').textContent ?? '/orders';
  return new URL(value, 'https://console.test').searchParams;
}

function orderRequestCount(limit: string): number {
  return getRequests.filter((url) => url.searchParams.get('limit') === limit).length;
}
