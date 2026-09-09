import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DependencyProvider } from '../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { Component } from './ProductDetailRoute';

const sections: string[] = [];
let pricingUnavailable = false;
const server = setupServer(
  http.get('*/api/v1/catalog/products/:productid', ({ request }) => {
    const section = new URL(request.url).searchParams.get('section') ?? '';
    sections.push(section);
    return HttpResponse.json(detail(section, pricingUnavailable));
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  sections.length = 0;
  pricingUnavailable = false;
});
afterAll(() => server.close());

describe('Product detail route', () => {
  it('loads the authoritative deep link through isolated core, pricing, inventory and qualification partitions', async () => {
    renderRoute();

    expect(await screen.findByRole('heading', { name: '办公福利礼盒', level: 1 })).toBeTruthy();
    for (const heading of ['基础信息', '规格', '媒体', '报价', '库存', '资格', '渠道', '投池', '时间线']) {
      expect(screen.getByRole('heading', { name: heading, level: 2 })).toBeTruthy();
    }
    expect(await screen.findByText('¥99.00')).toBeTruthy();
    expect(screen.getByText('符合售卖资格')).toBeTruthy();
    expect(screen.getByText('办公用品池')).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回商品列表' })).toBeTruthy();
    await waitFor(() => expect([...sections].sort()).toEqual(['core', 'inventory', 'pricing', 'qualification']));
  });

  it('keeps healthy detail partitions usable when pricing is unavailable', async () => {
    pricingUnavailable = true;
    renderRoute();

    expect(await screen.findByText('报价服务暂时不可用；其他商品信息仍可查看。')).toBeTruthy();
    expect(screen.getByRole('table', { name: '商品库存' })).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重试' })).toBeTruthy();
  });
});

function renderRoute() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter initialEntries={['/scopes/mall/mall%3Aone/products/product%3Aone']}>
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={context}>
            <Routes>
              <Route path="/scopes/:scopeKind/:scopeId/products/:productId" Component={Component} />
            </Routes>
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function detail(section: string, unavailable: boolean) {
  const state = (dependency: 'pricing' | 'inventory' | 'qualification') => ({
    state: section === dependency ? (unavailable && dependency === 'pricing' ? 'unavailable' : 'ready') : 'notrequested',
    watermark: section === dependency && !(unavailable && dependency === 'pricing') ? '4' : null,
    code: unavailable && dependency === 'pricing' && section === 'pricing' ? 'DEPENDENCY_UNAVAILABLE' : null,
  });
  return {
    section,
    id: 'product:one',
    title: '办公福利礼盒',
    description: '适合日常办公场景的福利组合。',
    product_type: 'physical',
    status: 'active',
    version: 7,
    category_id: 'category:office',
    category_name: '办公用品',
    brand_id: null,
    brand_name: null,
    owner_partner_id: 'partner:one',
    owner_partner_name: '央企供应链',
    cover_url: null,
    subtitle: '企业精选',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-07T08:00:00.000Z',
    skus: [{ id: 'sku:one', code: 'SKU-1', status: 'active', specifications: [{ name: '规格', value: '标准礼盒' }], version: 2 }],
    listings: [
      {
        id: 'listing:one',
        scope: 'mall:one',
        scopeName: '华东福利商城',
        pool: 'pool:one',
        poolName: '办公用品池',
        sku: 'sku:one',
        skuCode: 'SKU-1',
        title: '办公福利礼盒',
        status: 'published',
        effectiveAt: '2026-09-01T00:00:00.000Z',
        expiresAt: null,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-07T08:00:00.000Z',
        version: 3,
      },
    ],
    media: [],
    channels: [{ provider: 'supplier', externalId: 'EXT-1001', status: 'mapped', sourceVersion: 'v4', observedAt: '2026-09-07T07:00:00.000Z' }],
    pools: [{ id: 'pool:one', name: '办公用品池', kind: 'private', status: 'active', listingCount: 1 }],
    timeline: [{ id: 'timeline:one', kind: 'productupdated', title: '商品主档已更新', occurredAt: '2026-09-07T08:00:00.000Z', reference: 'product:one', referenceLabel: '办公福利礼盒' }],
    inventory: section === 'inventory' ? [{ sku: 'sku:one', skuCode: 'SKU-1', scope: 'mall:one', scopeName: '华东福利商城', location: 'warehouse:one', locationName: '主仓库', onhand: 14, safety: 2, status: 'active', version: 4 }] : [],
    prices:
      section === 'pricing' && !unavailable
        ? [
            {
              sku: 'sku:one',
              skuCode: 'SKU-1',
              scope: 'mall:one',
              scopeName: '华东福利商城',
              currency: 'CNY',
              amountMinor: 9900,
              compareMinor: 12900,
              bookStatus: 'active',
              effectiveAt: '2026-09-01T00:00:00.000Z',
              expiresAt: null,
              bookVersion: 'offer:four',
              priceVersion: 4,
            },
          ]
        : [],
    qualifications: section === 'qualification' ? [{ listing: 'listing:one', listingTitle: '办公福利礼盒', eligible: true, policyVersion: 4 }] : [],
    dependencies: {
      catalog: { state: 'ready', watermark: '7', code: null },
      pricing: state('pricing'),
      inventory: state('inventory'),
      qualification: state('qualification'),
    },
    gaps: unavailable && section === 'pricing' ? [{ dependency: 'pricing', code: 'DEPENDENCY_UNAVAILABLE' }] : [],
  };
}

const scope = { kind: 'mall', id: 'mall:one', tenant: 'tenant:one', name: '华东福利商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    scope,
    scopes: [scope],
    accessVersion: 7,
    permissions: ['catalog.product.read', 'catalog.listing.read'],
    capabilities: ['catalog.product.detail.read'],
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
