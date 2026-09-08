import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DependencyProvider } from '../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import { StepupProvider } from '../../../entity/session/StepupContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { Component } from './ProductRoute';
import { sourceListingFixture } from '../test/ProductFixture';

const requests: string[] = [];
const server = setupServer(
  http.get('*/api/v1/catalog/facets', ({ request }) => {
    const url = new URL(request.url);
    requests.push(`${url.pathname}${url.search}`);
    return HttpResponse.json({
      categories: [{ value: 'category:office', label: '办公用品', count: 1 }],
      suppliers: [{ value: 'partner:one', label: null, count: 1 }],
      malls: [{ value: 'mall:one', label: null, count: 1 }],
      statuses: [{ value: 'published', label: null, count: 1 }],
    });
  }),
  http.get('*/api/v1/catalog/listings', ({ request }) => {
    const url = new URL(request.url);
    requests.push(`${url.pathname}${url.search}`);
    return HttpResponse.json({
      items: [
        {
          id: 'listing:one',
          scope_id: 'mall:one',
          pool_id: null,
          pool_name: null,
          sku_id: 'sku:one',
          product_id: 'product:one',
          title: '办公福利礼盒',
          status: 'published',
          version: 3,
          code: 'SKU001',
          product_type: 'physical',
          cover_url: null,
          subtitle: null,
          effective_at: null,
          expires_at: null,
          cursor_sort: '2026-09-07T08:00:00.000Z',
          category_id: 'category:office',
          category_name: '办公用品',
          source: 'self',
          source_partner_id: null,
          source_partner_name: null,
          sku_count: 1,
          sku_total: 1,
          mall_count: 1,
          mall_total: 1,
          price_amount_minor: 9900,
          price_currency: 'CNY',
          price_version: 3,
          saleable_stock: 12,
          qualification_eligible: true,
          data_gaps: [],
        },
      ],
      count: 1,
    });
  }),
  http.all('*/api/v1/catalog/**', ({ request }) => {
    requests.push(new URL(request.url).pathname);
    return HttpResponse.json({ code: 'UNEXPECTED_PRODUCT_REQUEST' }, { status: 500 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  server.resetHandlers();
  requests.length = 0;
});
afterAll(() => server.close());

describe('Product route', () => {
  it('loads only the aggregate product list on first render and keeps pools and details lazy', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/products']}>
        <QueryClientProvider client={client}>
          <DependencyProvider value={createConsoleDependencies()}>
            <ConsoleContextProvider value={context}>
              <StepupProvider controller={stepup}><Component /></StepupProvider>
            </ConsoleContextProvider>
          </DependencyProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('table', { name: '商品列表' })).toBeTruthy();
    expect(screen.getByText('办公福利礼盒')).toBeTruthy();
    expect(screen.getByText(/^商品编号 \d{4} \d{4}$/)).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '分类 / 来源' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'SKU 摘要' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '商城覆盖' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '有效售价' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '可售库存' })).toBeTruthy();
    expect([...requests].sort()).toEqual(['/api/v1/catalog/facets', '/api/v1/catalog/listings?limit=50']);
  });

  it('restores supported filters and page density from the URL', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/products?q=%E7%A4%BC%E7%9B%92&category=category%3Aoffice&supplier=partner%3Aone&mall=mall%3Aone&status=published&limit=20']}>
        <QueryClientProvider client={client}>
          <DependencyProvider value={createConsoleDependencies()}>
            <ConsoleContextProvider value={context}>
              <StepupProvider controller={stepup}><Component /></StepupProvider>
            </ConsoleContextProvider>
          </DependencyProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(await screen.findByRole('table', { name: '商品列表' })).toBeTruthy();
    expect(screen.getByDisplayValue('礼盒')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: '分类' })).toHaveProperty('value', 'category:office');
    expect(screen.getByRole('combobox', { name: '供应商' })).toHaveProperty('value', 'partner:one');
    expect(screen.getByRole('combobox', { name: '商城范围' })).toHaveProperty('value', 'mall:one');
    expect(screen.getByRole('combobox', { name: '状态' })).toHaveProperty('value', 'published');
    expect(screen.getByRole('combobox', { name: '每页数量' })).toHaveProperty('value', '20');
    expect([...requests].sort()).toEqual(['/api/v1/catalog/facets?q=%E7%A4%BC%E7%9B%92', '/api/v1/catalog/listings?limit=20&q=%E7%A4%BC%E7%9B%92&category=category%3Aoffice&supplier=partner%3Aone&mall=mall%3Aone&status=published']);
  });

  it('keeps the product list usable when the independent Facet request fails', async () => {
    server.use(http.get('*/api/v1/catalog/facets', () => HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'facet unavailable' }, { status: 503 })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/products']}>
        <QueryClientProvider client={client}>
          <DependencyProvider value={createConsoleDependencies()}>
            <ConsoleContextProvider value={context}>
              <StepupProvider controller={stepup}><Component /></StepupProvider>
            </ConsoleContextProvider>
          </DependencyProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(await screen.findByText('办公福利礼盒')).toBeTruthy();
    expect(await screen.findByRole('button', { name: '筛选项加载失败，重试' })).toBeTruthy();
    expect(screen.getByRole('table', { name: '商品列表' })).toBeTruthy();
  });

  it('keeps an unmapped supplier row inspectable without requesting a nonexistent product detail', async () => {
    server.use(
      http.get('*/api/v1/catalog/listings', () => HttpResponse.json({ items: [sourceListingFixture()], count: 1 }))
    );
    renderRoute(context);

    await userEvent.setup().click(await screen.findByText('渠道福利礼盒'));
    const detail = screen.getByRole('button', { name: '打开完整详情' });
    expect(detail.hasAttribute('disabled')).toBe(true);
    expect(detail.getAttribute('title')).toBe('渠道商品尚未映射到商品主档');
    expect(requests.every((request) => !request.includes('/api/v1/catalog/products/'))).toBe(true);
  });

  it('explains and disables every write entry for a read-only product operator', async () => {
    renderRoute(readonlyContext);

    expect((await screen.findByRole('button', { name: '新建商品' })).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '商品池' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '导入商品' }).hasAttribute('disabled')).toBe(true);
    await screen.findByText('办公福利礼盒');
    await userEvent.setup().click(screen.getByRole('checkbox', { name: '选择 办公福利礼盒' }));
    expect(screen.getByRole('button', { name: '批量上架' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('当前账号没有批量上架或下架商品的权限。')).toBeTruthy();
  });
});

function renderRoute(value: ConsoleContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter initialEntries={['/products']}>
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={value}>
            <StepupProvider controller={stepup}><Component /></StepupProvider>
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const scope = { kind: 'mall', id: 'mall:one', tenant: 'tenant:one', name: '华东福利商城' } as const;
const stepup = { request: () => undefined };
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    scope,
    scopes: [scope],
    accessVersion: 7,
    permissions: ['catalog.product.read', 'catalog.product.manage', 'catalog.listing.read', 'catalog.listing.manage'],
    capabilities: ['catalog.listings.read', 'catalog.facets.read', 'catalog.products.create', 'catalog.products.update', 'catalog.products.archive', 'catalog.product.detail.read', 'catalog.pools.read'],
    assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    target: 'console',
    csrf: 'csrf-token-value',
    syncedAt: '2026-09-07T08:00:00.000Z',
  },
  profile: { display_name: '商品运营', employee_no: null },
  scopes: [scope],
  scope,
};
const readonlyContext: ConsoleContext = {
  ...context,
  session: {
    ...context.session,
    permissions: ['catalog.product.read', 'catalog.listing.read'],
    capabilities: ['catalog.listings.read', 'catalog.facets.read', 'catalog.product.detail.read'],
  },
};
