import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './CockpitRoute';

const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [], capabilities: [], target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
    assurance: { level: 1 }, syncedAt: '2026-08-26T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:1' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
};

const server = setupServer(http.get('*/api/v1/reports/dashboard', ({ request }) => {
  const url = new URL(request.url);
  if (request.headers.get('x-scope-hint') !== 'enterprise:1' || request.headers.get('x-access-version') !== '7'
    || url.searchParams.get('period') !== '30days') {
    return HttpResponse.json({ code: 'TEST_CONTEXT_MISSING', requestId: 'request:test' }, { status: 400 });
  }
  return HttpResponse.json({
    items: [], count: 0,
    summary: {
      catalogCount: 5008, availableStock: 80, orderCount: 7, afterSaleCount: 1,
      sales: {
        asOf: '2026-08-26T00:00:00Z', cumulativeSalesCents: 31500, paidOrderCount: 7,
        averageOrderValueCents: 4500, periodSalesCents: 31500, periodPaidOrderCount: 7, refundedCents: 0,
        activeProductCount: 5008, soldProductCount: 7, unsoldActiveProductCount: 5001,
        trend: [{ date: '2026-08-26', salesCents: 31500, orderCount: 7 }], categories: [], topProducts: [],
        period: { from: '2026.07.26', to: '2026.08.24' }, conclusion: '本期经营保持增长，需要关注。',
        deltas: { netSalesRatio: 0.128, paidOrdersRatio: 0.086, averageOrderRatio: 0.039, refundRate: 0.028, refundRateDeltaPoints: 0.006 },
        malls: [{ id: 'mall:1', name: '鸿泰惠民通', salesCents: 19600, paidOrderCount: 4, refundRate: 0.021 }],
        events: [{ id: 'event:1', kind: 'calendar', title: '鸿泰惠民通会员日完成', metric: '成交额 ¥186.00', time: '20:42' }],
        insights: [{ id: 'insight:1', tone: 'warning', title: '退款率高于集团均值', action: '查看售后订单', target: 'orders' }],
      },
    },
  });
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());

function renderCockpit() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(<MemoryRouter initialEntries={['/?period=30days']}><QueryClientProvider client={client}>
    <ConsoleContextProvider value={context}><Component /></ConsoleContextProvider>
  </QueryClientProvider></MemoryRouter>);
}

describe('Cockpit route', () => {
  it('renders the scoped Operation response without cross-domain browser aggregation', async () => {
    renderCockpit();
    expect(await screen.findByRole('heading', { level: 1, name: '经营驾驶舱' })).toBeTruthy();
    expect(screen.getByText('¥315.00')).toBeTruthy();
    expect(screen.getByText('环比 +12.8%')).toBeTruthy();
    expect(await screen.findByRole('img', { name: '净成交额折线与支付订单柱形组合趋势' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: '商城经营对比' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: '查看售后订单 →' })).toBeTruthy();
  });

  it('renders the complete cockpit with zero values when the authoritative read model is empty', async () => {
    server.use(http.get('*/api/v1/reports/dashboard', () => HttpResponse.json({
      items: [], count: 0,
      summary: {
        catalogCount: 0, availableStock: 0, orderCount: 0, afterSaleCount: 0,
        sales: {
          asOf: '2026-08-31T00:00:00Z', cumulativeSalesCents: 0, paidOrderCount: 0,
          averageOrderValueCents: 0, periodSalesCents: 0, periodPaidOrderCount: 0, refundedCents: 0,
          activeProductCount: 0, soldProductCount: 0, unsoldActiveProductCount: 0,
          trend: [], categories: [], topProducts: [],
        },
      },
    })));
    renderCockpit();
    expect(await screen.findByRole('heading', { level: 1, name: '经营驾驶舱' })).toBeTruthy();
    expect(screen.getByText('当前周期暂无经营数据，所有指标按 0 展示。')).toBeTruthy();
    expect(screen.getAllByText('环比 0.0%')).toHaveLength(3);
    expect(await screen.findByRole('img', { name: '净成交额折线与支付订单柱形组合趋势' })).toBeTruthy();
    expect(await screen.findByText('全部商城')).toBeTruthy();
    expect(await screen.findByText('0 条')).toBeTruthy();
    expect(await screen.findByText('需要关注 0 项')).toBeTruthy();
    expect(screen.queryByText('暂无数据')).toBeNull();
  });
});
