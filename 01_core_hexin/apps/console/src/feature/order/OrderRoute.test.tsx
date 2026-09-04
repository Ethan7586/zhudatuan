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
  total_minor: 12_800,
  currency: 'CNY',
  payment_state: 'paid',
  fulfillment_state: 'allocated',
  aftersale_state: 'none',
  lifecycle_state: 'active',
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
      provider: null,
      partner: null,
    },
  ],
  preview: {
    source: 'local-preview',
    memberName: '不应泄漏的演示会员',
    enterpriseName: '不应泄漏的演示企业',
    mallName: '不应泄漏的演示商城',
    paidMinor: 9_900,
    paymentMethod: '不应泄漏的演示支付方式',
    benefitMinor: 4_900,
    wechatMinor: 5_000,
    supplierName: '不应泄漏的演示供应商',
    fulfillmentId: 'fulfillment:preview-only',
    slaMinutes: 15,
    addressSummary: '不应泄漏的演示地址',
    summary: '不应泄漏的演示说明',
    milestones: [],
    operation: { id: 'operation:preview-only', label: '演示 Operation', status: 'succeeded', at: '2026-08-26T09:00:00.000Z' },
    exception: false,
  },
} as const;

const listPage = {
  items: [order],
  count: 1,
  nextCursor: 'cursor:next',
  preview: {
    source: 'local-preview',
    total: 7,
    updatedAt: '2026-08-26T09:00:00.000Z',
    page: 1,
    counts: { all: 7, unpaid: 1, unshipped: 2, active: 2, completed: 2, aftersale: 1, exception: 1 },
  },
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
    scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
    assurance: { level: 2, verified: '2026-08-26T08:00:00.000Z' },
    syncedAt: '2026-08-26T08:00:00.000Z',
  },
  profile: { display_name: '测试订单运营', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:1' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
};

const previewScope = { kind: 'platform', id: 'platform:preview' } as const;
const previewContext: ConsoleContext = {
  ...context,
  session: { ...context.session, scope: previewScope, scopes: [previewScope] },
  scope: previewScope,
  scopes: [previewScope],
};

const getRequests: URL[] = [];
const postRequests: URL[] = [];
const server = setupServer(
  http.get('*/api/v1/orders', ({ request }) => {
    const url = new URL(request.url);
    getRequests.push(url);
    if (!['enterprise:1', 'platform:preview'].includes(request.headers.get('x-scope-hint') ?? '') || request.headers.get('x-access-version') !== '7') {
      return HttpResponse.json({ code: 'TEST_CONTEXT_MISSING', requestId: 'request:order-test' }, { status: 400 });
    }
    if (url.searchParams.get('limit') === '1') {
      return HttpResponse.json(url.searchParams.get('order') === order.id ? { items: [order], count: 1 } : { items: [], count: 0 });
    }
    return HttpResponse.json(listPage);
  }),
  http.post('*', ({ request }) => {
    postRequests.push(new URL(request.url));
    return HttpResponse.json({ code: 'UNEXPECTED_WRITE', requestId: 'request:unexpected-write' }, { status: 500 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  getRequests.length = 0;
  postRequests.length = 0;
});
afterAll(() => server.close());

describe('Order route', () => {
  it('renders only production-authoritative fields and labels unavailable read-model data honestly', async () => {
    renderRoute();

    expect(await screen.findByRole('table', { name: '订单列表' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: '订单管理系统' })).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('当前生产读合同仅保证');
    expect(screen.getByText('服务端筛选 · 更新时间未提供')).toBeTruthy();
    expect(screen.getByText('本页 1 条 · 全量总数不可用')).toBeTruthy();
    expect(screen.getByText('member:verified-1')).toBeTruthy();
    expect(screen.getByText('企业显示名不可用')).toBeTruthy();
    expect(screen.getByTitle('当前读模型未返回 SLA').textContent).toBe('未提供');
    expect(screen.queryByText('不应泄漏的演示会员')).toBeNull();
    expect(screen.queryByText('不应泄漏的演示支付方式')).toBeNull();
    expect(screen.getByRole('button', { name: '全部订单' }).textContent).toBe('全部订单');

    const unpaid = screen.getByRole<HTMLButtonElement>('button', { name: '待付款' });
    const placed = screen.getByRole<HTMLSelectElement>('combobox', { name: '下单时间' });
    expect(unpaid.disabled).toBe(true);
    expect(placed.disabled).toBe(true);

    await userEvent.setup().click(screen.getByRole('button', { name: `查看订单 ${order.order_number}` }));
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    expect(within(dialog).getByText(/组织级完整性也未由当前 member audience 合同保证/)).toBeTruthy();
    expect(within(dialog).getAllByText('当前读模型未提供').length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/当前读模型未提供审计时间线/)).toBeTruthy();
    expect(within(dialog).queryByText('不应泄漏的演示说明')).toBeNull();
  });

  it('turns the preview exception view into a vertical responsibility workflow', async () => {
    const exceptionOrder = {
      ...order,
      payment_state: 'partially_refunded',
      fulfillment_state: 'returned',
      aftersale_state: 'processing',
      preview: {
        ...order.preview,
        exception: true,
        operation: { id: 'operation:refund-reconciliation', label: '退款对账等待确认', status: 'failed', at: '2026-08-26T08:28:00.000Z' },
      },
    } as const;
    server.use(
      http.get('*/api/v1/orders', ({ request }) => {
        const url = new URL(request.url);
        getRequests.push(url);
        if (url.searchParams.get('limit') === '1') return HttpResponse.json({ items: [exceptionOrder], count: 1 });
        return HttpResponse.json({
          items: [exceptionOrder],
          count: 1,
          preview: { ...listPage.preview, total: 1, counts: { ...listPage.preview.counts, exception: 1 } },
        });
      })
    );
    const user = userEvent.setup();
    renderRoute('/orders?view=exception', previewContext);

    expect(await screen.findByRole('heading', { level: 1, name: '订单协同异常' })).toBeTruthy();
    expect(screen.getByText('找到卡住的订单，确认责任系统，并直接去处理。')).toBeTruthy();
    expect(await screen.findByRole('list', { name: '异常订单列表' })).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(order.order_number) }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('list', { name: new RegExp(`${order.order_number} 纵向进度`) })).toBeTruthy();
    const actionPanel = screen.getByRole('region', { name: '当前卡点与处理动作' });
    expect(within(actionPanel).getByText('财务与对账台', { exact: true })).toBeTruthy();
    expect(within(actionPanel).getByRole('button', { name: '进入财务与对账台处理' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '查看完整订单详情' }));
    expect(await screen.findByRole('dialog', { name: new RegExp(order.order_number) })).toBeTruthy();
    expect(postRequests).toHaveLength(0);
  });

  it('normalizes preview-only URL filters out of a production scope before presenting results', async () => {
    renderRoute('/orders?view=unpaid&placed=today&lifecycle=active&payment=paid&fulfillment=allocated&mall=huimin&order=order%3Ainternal-1&campaign=keep');

    await screen.findByRole('table', { name: '订单列表' });
    await waitFor(() => expect(currentParams().has('view')).toBe(false));
    for (const key of ['placed', 'lifecycle', 'payment', 'fulfillment', 'mall']) {
      expect(currentParams().has(key)).toBe(false);
    }
    expect(currentParams().get('order')).toBe('order:internal-1');
    expect(currentParams().get('campaign')).toBe('keep');
    expect(screen.getByRole('button', { name: '全部订单' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: '支付状态' }).value).toBe('');
    const listRead = getRequests.find((url) => url.searchParams.get('limit') === '50');
    expect(listRead?.searchParams.get('order')).toBe('order:internal-1');
    expect(listRead?.searchParams.has('view')).toBe(false);
    expect(listRead?.searchParams.has('payment')).toBe(false);
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
    expect(within(dialog).getByRole('heading', { name: '最近 Operation' })).toBeTruthy();
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

  it('drops selections that no longer belong to the refreshed server page', async () => {
    const refreshedOrder = { ...order, id: 'order:internal-2', order_number: 'SW202608260002' };
    let listReads = 0;
    server.use(
      http.get('*/api/v1/orders', () => {
        listReads += 1;
        return HttpResponse.json({ ...listPage, items: [listReads === 1 ? order : refreshedOrder] });
      })
    );
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole('table', { name: '订单列表' });
    await user.click(screen.getByRole('checkbox', { name: `选择订单 ${order.order_number}` }));
    expect(await screen.findByText(/已选择 1 条当前页订单/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '刷新数据' }));
    const refreshedCheckbox = await screen.findByRole<HTMLInputElement>('checkbox', { name: `选择订单 ${refreshedOrder.order_number}` });
    await waitFor(() => expect(screen.queryByText(/已选择 1 条当前页订单/)).toBeNull());
    expect(refreshedCheckbox.checked).toBe(false);
  });

  it('renders the empty state', async () => {
    server.use(http.get('*/api/v1/orders', () => HttpResponse.json({ items: [], count: 0 })));
    renderRoute();

    expect(await screen.findByText('暂无符合条件的订单')).toBeTruthy();
    expect(screen.getByText('请调整服务端筛选条件后重试。')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '订单列表' })).toBeNull();
    expect(screen.getByText('本页 0 条 · 全量总数不可用')).toBeTruthy();
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

  it('configures optional columns and selecting a row never opens its drawer', async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole('table', { name: '订单列表' });

    const rowCheckbox = screen.getByRole<HTMLInputElement>('checkbox', { name: `选择订单 ${order.order_number}` });
    rowCheckbox.focus();
    await user.keyboard(' ');
    expect(await screen.findByText(/已选择 1 条当前页订单/)).toBeTruthy();
    expect(rowCheckbox.checked).toBe(true);
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

  it('clears row selection when the scope or access-version boundary changes', async () => {
    const user = userEvent.setup();
    server.use(http.get('*/api/v1/orders', () => HttpResponse.json(listPage)));
    const rendered = renderRoute();
    await screen.findByRole('table', { name: '订单列表' });
    await user.click(screen.getByRole('checkbox', { name: `选择订单 ${order.order_number}` }));
    expect(await screen.findByText(/已选择 1 条当前页订单/)).toBeTruthy();

    rendered.rerenderContext({ ...context, session: { ...context.session, accessVersion: 8 } });
    const refreshedCheckbox = await screen.findByRole<HTMLInputElement>('checkbox', { name: `选择订单 ${order.order_number}` });
    expect(screen.queryByText(/已选择 1 条当前页订单/)).toBeNull();
    expect(refreshedCheckbox.checked).toBe(false);

    rendered.rerenderContext(context);
    const restoredCheckbox = await screen.findByRole<HTMLInputElement>('checkbox', { name: `选择订单 ${order.order_number}` });
    expect(screen.queryByText(/已选择 1 条当前页订单/)).toBeNull();
    expect(restoredCheckbox.checked).toBe(false);
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

  it('keeps every exposed final action disabled and sends no POST even with AAL2 and write permissions', async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole('table', { name: '订单列表' });

    const exportButton = screen.getByRole<HTMLButtonElement>('button', { name: '导出订单' });
    const moreFilters = screen.getByRole<HTMLButtonElement>('button', { name: '更多筛选' });
    const rowMore = screen.getByRole<HTMLButtonElement>('button', { name: `订单 ${order.order_number} 更多操作` });
    expect(exportButton.disabled).toBe(true);
    expect(moreFilters.disabled).toBe(true);
    expect(rowMore.disabled).toBe(true);
    await user.click(exportButton);
    await user.click(moreFilters);
    await user.click(rowMore);

    await user.click(screen.getByRole('button', { name: `查看订单 ${order.order_number}` }));
    const dialog = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    const more = within(dialog).getByRole<HTMLButtonElement>('button', { name: '更多' });
    const fulfill = within(dialog).getByRole<HTMLButtonElement>('button', { name: '确认发货' });
    expect(more.disabled).toBe(true);
    expect(fulfill.disabled).toBe(true);
    expect(within(dialog).getByText(/action-bound proof 与 Operation 回执/)).toBeTruthy();
    await user.click(more);
    await user.click(fulfill);
    expect(postRequests).toHaveLength(0);
  });

  it('opens and closes every preview-only order action without sending a write request', async () => {
    const user = userEvent.setup();
    renderRoute('/orders', previewContext);
    await screen.findByRole('table', { name: '订单列表' });

    await openAndCloseSafePreview(user, screen.getByRole('button', { name: '导出订单' }), '导出订单预览');
    await openAndCloseSafePreview(user, screen.getByRole('button', { name: '更多筛选' }), '更多筛选');
    await openAndCloseSafePreview(user, screen.getByRole('button', { name: `订单 ${order.order_number} 更多操作` }), `订单操作预览 ${order.order_number}`);

    await user.click(screen.getByRole('button', { name: `查看订单 ${order.order_number}` }));
    const drawer = await screen.findByRole('dialog', { name: new RegExp(order.order_number) });
    await openAndCloseSafePreview(user, within(drawer).getByRole('button', { name: '更多' }), '更多订单操作');
    await openAndCloseSafePreview(user, within(drawer).getByRole('button', { name: '确认发货' }), '确认发货预览');

    expect(postRequests).toHaveLength(0);
  });
});

async function openAndCloseSafePreview(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, name: string) {
  expect((trigger as HTMLButtonElement).disabled).toBe(false);
  await user.click(trigger);
  const dialog = await screen.findByRole('dialog', { name });
  expect(within(dialog).getByText(/不会发起写操作/)).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: '关闭' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name })).toBeNull());
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
