import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './OrderRoute';

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
  evidence: {},
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
} as const;

const aftersale = {
  id: 'aftersale:verified-1',
  orderId: order.id,
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
    permissions: ['order.orders.export', 'fulfillment.shipments.create', 'payment.refunds.request', 'order.aftersales.approve', 'order.aftersales.reject'],
    capabilities: ['order.write', 'fulfillment.write', 'payment.refund'],
    target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:1' },
    scopes: [
      { kind: 'enterprise', id: 'enterprise:1' },
      { kind: 'mall', id: 'mall:verified-1', name: '员工福利商城' },
    ],
    assurance: { level: 2, verified: '2026-08-26T08:00:00.000Z' },
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
    if (url.searchParams.get('limit') === '1') {
      return HttpResponse.json(url.searchParams.get('order') === order.id ? { items: [order], count: 1 } : { items: [], count: 0 });
    }
    return HttpResponse.json(listPage);
  }),
  http.get('*/api/v1/orders/aftersales', ({ request }) => {
    const url = new URL(request.url);
    getRequests.push(url);
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:1');
    return HttpResponse.json({ items: [aftersale], count: 1, availableLines: [] });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  getRequests.length = 0;
});
afterAll(() => server.close());

describe('Order route', () => {
  it('renders only production-authoritative fields and labels unavailable read-model data honestly', async () => {
    renderRoute();

    expect(await screen.findByRole('table', { name: '订单列表' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '订单管理' })).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('由服务端按当前数据范围权威筛选');
    expect(screen.getByText('当前条件由服务端实时筛选')).toBeTruthy();
    expect(screen.getByText('本页 1 条')).toBeTruthy();
    expect(screen.getByText(/^会员 \d{4} \d{4}$/)).toBeTruthy();
    expect(screen.getByText(/^组织范围 \d{4} \d{4}$/)).toBeTruthy();
    expect(screen.queryByText('member:verified-1')).toBeNull();
    expect(screen.queryByText('enterprise:1')).toBeNull();
    expect(screen.queryByText('SKU-VERIFIED-1')).toBeNull();
    expect(screen.getByText(/^商品规格 \d{4} \d{4} · 共 2 件$/)).toBeTruthy();
    expect(screen.queryByText('不应泄漏的演示会员')).toBeNull();
    expect(screen.queryByText('不应泄漏的演示支付方式')).toBeNull();
    expect(screen.getByRole('button', { name: '全部订单' }).textContent).toBe('全部订单');

    for (const label of ['全部订单', '待付款', '待发货', '履约中', '已完成', '售后与退款', '异常订单']) {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: label }).disabled).toBe(false);
    }
    for (const label of ['下单时间', '订单进度', '支付状态', '履约状态', '所属商城']) {
      expect(screen.getByRole<HTMLSelectElement>('combobox', { name: label }).disabled).toBe(false);
    }
    expect(screen.queryByRole('button', { name: '导出订单' })).toBeNull();

    await userEvent.setup().click(screen.getByRole('button', { name: `查看订单 ${order.order_number}` }));
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) }, { timeout: 5_000 });
    expect(within(dialog).getAllByText('当前读模型未提供').length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/当前读模型未提供审计时间线/)).toBeTruthy();
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
            url.searchParams.get('mall') === 'mall:verified-1'
        )
      ).toBe(true)
    );
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
    expect(getRequests.some((url) => url.searchParams.get('limit') === '1' && url.searchParams.get('order') === order.id)).toBe(true);

    await user.click(screen.getByRole('button', { name: '关闭订单详情' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(currentParams().get('selected')).toBeNull();

    const row = screen.getByRole('row', { name: new RegExp(order.order_number) });
    row.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: new RegExp(order.order_number) })).toBeTruthy();
    expect(currentParams().get('selected')).toBe(order.id);
  });

  it('supports all five drawer tabs by keyboard and click, then closes without losing unrelated URL state', async () => {
    const user = userEvent.setup();
    renderRoute(`/orders?selected=${encodeURIComponent(order.id)}&campaign=keep`);
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    const overview = within(dialog).getByRole('tab', { name: '订单概览' });
    const products = within(dialog).getByRole('tab', { name: '商品与履约' });
    const payment = within(dialog).getByRole('tab', { name: '支付与退款' });
    const aftersale = within(dialog).getByRole('tab', { name: '售后' });
    const operations = within(dialog).getByRole('tab', { name: '操作记录' });
    expect([overview, products, payment, aftersale, operations]).toHaveLength(5);
    expect(overview.getAttribute('aria-selected')).toBe('true');

    overview.focus();
    await user.keyboard('{ArrowRight}{Enter}');
    await waitFor(() => expect(products.getAttribute('aria-selected')).toBe('true'));
    expect(within(dialog).getByRole('heading', { name: '商品与履约快照' })).toBeTruthy();
    expect(currentParams().get('tab')).toBe('products');

    await user.click(payment);
    expect(within(dialog).getByRole('heading', { name: '支付快照' })).toBeTruthy();
    await user.click(aftersale);
    expect(within(dialog).getByRole('heading', { name: '售后状态' })).toBeTruthy();
    await user.click(operations);
    expect(within(dialog).getByRole('heading', { name: '最近操作记录' })).toBeTruthy();
    await user.click(overview);
    expect(within(dialog).getByRole('heading', { name: '金额与支付' })).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: '关闭订单详情' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(currentParams().get('selected')).toBeNull();
    expect(currentParams().get('tab')).toBeNull();
    expect(currentParams().get('campaign')).toBe('keep');
  });

  it('restores the selected order and detail tab from the initial URL', async () => {
    renderRoute(`/orders?selected=${encodeURIComponent(order.id)}&tab=payment&campaign=restore`);
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });

    expect(within(dialog).getByRole('tab', { name: '支付与退款' }).getAttribute('aria-selected')).toBe('true');
    expect(within(dialog).getByRole('heading', { name: '支付快照' })).toBeTruthy();
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
    server.use(http.get('*/api/v1/orders', () => HttpResponse.json({ items: [], count: 0 })));
    renderRoute();

    expect(await screen.findByText('暂无符合条件的订单')).toBeTruthy();
    expect(screen.getByText('请调整服务端筛选条件后重试。')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '订单列表' })).toBeNull();
    expect(screen.getByText('本页 0 条')).toBeTruthy();
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

  it('configures optional columns without exposing unsupported bulk selection', async () => {
    const user = userEvent.setup();
    renderRoute();
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
  });

  it('clears cursor on filter submit while preserving unrelated URL parameters', async () => {
    const user = userEvent.setup();
    renderRoute('/orders?cursor=cursor%3Aold&campaign=keep');
    await screen.findByRole('table', { name: '订单列表' });

    const input = screen.getByRole('textbox', { name: '订单搜索' });
    await user.clear(input);
    await user.type(input, 'order:searched');
    await user.click(screen.getByRole('button', { name: '筛选订单' }));

    await waitFor(() => expect(currentParams().get('order')).toBe('order:searched'));
    expect(currentParams().get('cursor')).toBeNull();
    expect(currentParams().get('campaign')).toBe('keep');
    await waitFor(() => expect(getRequests.some((url) => url.searchParams.get('limit') === '50' && url.searchParams.get('order') === 'order:searched' && !url.searchParams.has('cursor'))).toBe(true));
  });

  it('does not expose controls that have no production operation contract', async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole('table', { name: '订单列表' });

    expect(screen.queryByRole('button', { name: '导出订单' })).toBeNull();
    expect(screen.queryByRole('button', { name: '更多筛选' })).toBeNull();
    expect(screen.queryByRole('button', { name: `订单 ${order.order_number} 更多操作` })).toBeNull();

    await user.click(screen.getByRole('button', { name: `查看订单 ${order.order_number}` }));
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    expect(within(dialog).queryByRole('button', { name: '更多' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: '确认发货' })).toBeNull();
  });
});

function renderRoute(entry = '/orders', initialContext = context) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  const route = (value: ConsoleContext) => (
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={value}>
          <Component />
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
