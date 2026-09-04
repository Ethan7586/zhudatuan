import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { DependencyProvider } from '../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { Component } from './CockpitRoute';

let dashboardReads = 0;

const context: ConsoleContext = {
  session: {
    actor: 'actor:1',
    membership: 'membership:1',
    accessVersion: 7,
    permissions: [],
    capabilities: [],
    target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:1' },
    scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
    assurance: { level: 1 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    syncedAt: '2026-08-26T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:1' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
};

const server = setupServer(
  http.get('*/api/v1/reports/dashboard', ({ request }) => {
    dashboardReads += 1;
    const url = new URL(request.url);
    if (request.headers.get('x-scope-hint') !== 'enterprise:1' || request.headers.get('x-access-version') !== '7' || url.searchParams.get('period') !== '30days') {
      return HttpResponse.json({ code: 'TEST_CONTEXT_MISSING', requestId: 'request:test' }, { status: 400 });
    }
    return HttpResponse.json({
      items: [],
      count: 0,
      snapshot: { query: { scope: 'enterprise:1', dimension: null, period: '30days', application: null }, watermark: { event: 'event:one', occurredAt: '2026-08-26T00:00:00Z', version: 8 }, generatedAt: '2026-08-26T00:00:01Z', generationVersion: 1 },
      summary: {
        catalogCount: 5008,
        availableStock: 80,
        orderCount: 7,
        afterSaleCount: 1,
        sales: {
          asOf: '2026-08-26T00:00:00Z',
          cumulativeSalesCents: 31500,
          paidOrderCount: 7,
          averageOrderValueCents: 4500,
          periodSalesCents: 31500,
          periodPaidOrderCount: 7,
          refundedCents: 0,
          activeProductCount: 5008,
          soldProductCount: 7,
          unsoldActiveProductCount: 5001,
          period: { from: '2026-07-28T00:00:00Z', to: '2026-08-26T00:00:00Z' },
          conclusion: '净成交额较上一等长周期增长，经营表现向好。',
          deltas: { netSalesRatio: 0.1, paidOrdersRatio: 0.05, averageOrderRatio: 0.02, refundRate: 0, refundRateDeltaPoints: 0 },
          trend: [{ date: '2026-08-26', salesCents: 31500, orderCount: 7 }],
          weeklyTrend: [{ date: '2026-08-24', salesCents: 31500, orderCount: 7 }],
          categories: [],
          topProducts: [{ productId: 'product:1', name: '办公套装', salesCents: 12800, quantity: 2, orderCount: 1 }],
          malls: [{ id: 'mall:1', name: '测试商城', salesCents: 31500, paidOrderCount: 7, refundRate: 0 }],
          events: [{ id: 'event:1', kind: 'calendar', title: '订单支付', metric: '¥315.00', time: '2026-08-26T00:00:00Z', date: '2026-08-26' }],
          insights: [{ id: 'growth', tone: 'positive', title: '净成交额保持增长', detail: '较上一周期增长', action: '查看报表', target: 'reports' }],
        },
      },
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  dashboardReads = 0;
});
afterAll(() => server.close());

describe('Cockpit route', () => {
  it('renders the scoped Operation response without cross-domain browser aggregation', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    render(
      <MemoryRouter initialEntries={['/?period=30days']}>
        <QueryClientProvider client={client}>
          <DependencyProvider value={createConsoleDependencies()}>
            <ConsoleContextProvider value={context}>
              <Component />
            </ConsoleContextProvider>
          </DependencyProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { level: 1, name: '经营驾驶舱' })).toBeTruthy();
    expect((await screen.findAllByText('¥315.00')).length).toBeGreaterThan(0);
    expect(screen.getByText('环比 +10.0%')).toBeTruthy();
    expect(screen.getByRole('img', { name: '净成交额折线与支付订单柱形组合趋势' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '分类销售占比' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '热销商品' })).toBeTruthy();
    expect(screen.getByText('办公套装')).toBeTruthy();
    expect(screen.getByRole('button', { name: '办公套装' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '查看订单 →' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '商城经营对比' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '最近经营动态' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '需要关注' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '经营明细' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '经营指标' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '经营趋势' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '经营待办' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '经营异常' })).toBeTruthy();
    expect(dashboardReads).toBe(1);
  });

  it('renders authoritative zero values instead of replacing the dashboard with a generic empty state', async () => {
    server.use(
      http.get('*/api/v1/reports/dashboard', () =>
        HttpResponse.json({
          items: [],
          count: 0,
          snapshot: { query: { scope: 'enterprise:1', dimension: null, period: '30days', application: null }, watermark: { event: 'event:zero', occurredAt: '2026-08-26T00:00:00Z', version: 1 }, generatedAt: '2026-08-26T00:00:01Z', generationVersion: 1 },
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
              period: { from: '2026-07-28T00:00:00Z', to: '2026-08-26T00:00:00Z' },
              conclusion: '当前周期暂无净成交，请检查商品可售状态与渠道运行情况。',
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
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    render(
      <MemoryRouter initialEntries={['/?period=30days']}>
        <QueryClientProvider client={client}>
          <DependencyProvider value={createConsoleDependencies()}>
            <ConsoleContextProvider value={context}>
              <Component />
            </ConsoleContextProvider>
          </DependencyProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { level: 1, name: '经营驾驶舱' })).toBeTruthy();
    expect((await screen.findAllByText('¥0.00')).length).toBeGreaterThan(0);
    expect(screen.getByText('暂无权威趋势数据')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '暂无数据' })).toBeNull();
  });
});
