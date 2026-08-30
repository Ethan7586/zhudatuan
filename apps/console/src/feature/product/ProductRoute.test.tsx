import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './ProductRoute';

const server = setupServer(
  http.get('*/api/v1/catalog/listings', () => HttpResponse.json(productPage)),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Product governance workspace', () => {
  it('hides cached product data and an open drawer when access is revoked', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/products']}>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={context}>
            <Component />
          </ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('table', { name: '商品列表' });
    await user.click(screen.getByRole('button', { name: /核心商品product:1/ }));
    expect(await screen.findByRole('dialog', { name: '核心商品' })).toBeTruthy();

    server.use(http.get('*/api/v1/catalog/listings', () => HttpResponse.json(
      { code: 'PRODUCT_READ_DENIED', requestId: 'request:revoked' },
      { status: 403 },
    )));
    await client.invalidateQueries();

    const access = await screen.findByRole('region', { name: '需要访问权限' });
    await waitFor(() => expect(document.activeElement).toBe(access));
    expect(within(access).getByText('当前账号尚未开通「商品治理台」。')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('table', { name: '商品列表' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: '商品管理' })).toBeNull();
    expect(screen.queryByRole('region', { name: '商品筛选' })).toBeNull();
    expect(screen.queryByText('核心商品')).toBeNull();
    expect(screen.queryByRole('button', { name: '新建商品' })).toBeNull();
  });
});

const productPage = {
  items: [{
    id: 'listing:1',
    sku_id: 'sku:1',
    product_id: 'product:1',
    title: '核心商品',
    status: 'published',
    version: 3,
  }],
  count: 1,
};

const scope = { kind: 'enterprise' as const, id: 'enterprise:1', name: '鸿泰集团' };
const context: ConsoleContext = {
  session: {
    actor: 'actor:product',
    membership: 'membership:product',
    accessVersion: 7,
    permissions: [],
    capabilities: ['catalog.listings.read'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 2 },
    syncedAt: '2026-08-30T00:00:00.000Z',
  },
  profile: { display_name: '测试商品运营', employee_no: null },
  scope,
  scopes: [scope],
};
