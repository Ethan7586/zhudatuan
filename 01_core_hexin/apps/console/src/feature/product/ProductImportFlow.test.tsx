import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { ProductCreateDialog } from './ProductCreateDialog';
import { ProductImportDialog } from './ProductImportDialog';
import { Component as ProductImportRoute } from './ProductImportRoute';

const bodies: unknown[] = [];
const server = setupServer(
  http.post('*/api/v1/catalog/imports', async ({ request }) => {
    const body = await request.json();
    bodies.push(body);
    const confirmation = body !== null && typeof body === 'object' && 'confirmImportId' in body;
    return HttpResponse.json({ id: 'catalogimport:1', state: confirmation ? 'running' : 'uploaded',
      total_count: confirmation ? 1 : 0, cursor_value: 0, success_count: 0, failure_count: 0 });
  }),
  http.get('*/api/v1/catalog/imports/:id', () => HttpResponse.json(importReady)),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { cleanup(); server.resetHandlers(); bodies.length = 0; vi.restoreAllMocks(); });
afterAll(() => server.close());

describe('product import flow', () => {
  it('uploads a fixed standard package and returns the server job', async () => {
    const user = userEvent.setup();
    const created = vi.fn();
    renderWithContext(<ProductImportDialog context={context} open onClose={() => undefined} onCreated={created} />);
    const file = new File([standardPackage], 'hongtai-products.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('选择标准货盘包'), file);

    expect(await screen.findByText('package:test:1')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '上传并校验' }));
    await waitFor(() => expect(created).toHaveBeenCalledWith('catalogimport:1'));
    expect(bodies[0]).toMatchObject({ schema: 'catalog-package/v1', filename: 'hongtai-products.json' });
    expect((bodies[0] as Readonly<Record<string, unknown>>).content).toBe(standardPackage);
  });

  it('shows authoritative row errors and confirms only from the ready state', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/imports/catalog/catalogimport%3A1']}>
        <QueryClientProvider client={client}><ConsoleContextProvider value={context}>
          <Routes><Route path="/imports/catalog/:jobId" element={<ProductImportRoute />} /></Routes>
        </ConsoleContextProvider></QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('服务端校验已完成')).toBeTruthy();
    expect(screen.getByText('CATALOG_TITLE_REQUIRED')).toBeTruthy();
    expect(screen.getByText('product.title')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '确认保存草稿' }));
    await waitFor(() => expect(bodies).toContainEqual({ confirmImportId: 'catalogimport:1' }));
  });

  it('returns a completed import to the exact mall product path', async () => {
    const user = userEvent.setup();
    server.use(http.get('*/api/v1/catalog/imports/:id', () => HttpResponse.json({
      ...importReady, state: 'completed', success_count: 1, failure_count: 0,
    })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/scopes/mall/mall%3Ahongtai/imports/catalog/catalogimport%3A1']}>
        <QueryClientProvider client={client}><ConsoleContextProvider value={context}>
          <Routes><Route path="/scopes/mall/:scopeId/imports/catalog/:jobId" element={<ProductImportRoute />} /></Routes>
          <RouteLocation />
        </ConsoleContextProvider></QueryClientProvider>
      </MemoryRouter>,
    );

    await screen.findByText('商品草稿已保存');
    await user.click(screen.getByRole('button', { name: '去上架商品' }));
    expect(screen.getByTestId('route-location').textContent).toBe('/scopes/mall/mall%3Ahongtai/products');
  });

  it('compiles a manual product into the same standard-package validation path', async () => {
    const user = userEvent.setup();
    const created = vi.fn();
    renderWithContext(<ProductCreateDialog context={context} open onClose={() => undefined} onCreated={created} />);
    await user.type(screen.getByLabelText('商品标题'), '手工商品');
    await user.type(screen.getByLabelText('SKU 编码'), 'MANUAL-SKU-1');
    await user.type(screen.getByLabelText('分类编码'), 'personal');
    await user.type(screen.getByLabelText('售价（元）'), '39.90');
    await user.type(screen.getByLabelText('图片 HTTPS 地址'), 'https://cdn.example.com/manual.jpg');
    await user.type(screen.getByLabelText('商品描述'), '手工录入商品描述');
    await user.click(screen.getByRole('button', { name: '提交校验' }));

    await waitFor(() => expect(created).toHaveBeenCalledWith('catalogimport:1'));
    const request = bodies[0] as Readonly<Record<string, unknown>>;
    if (typeof request.content !== 'string') throw new Error('CATALOG_PACKAGE_CONTENT_MISSING');
    const compiled: unknown = JSON.parse(request.content);
    expect(compiled).toMatchObject({ schema: 'catalog-package/v1', source: { dataSource: 'manual' },
      items: [{ product: { title: '手工商品' }, sku: { code: 'MANUAL-SKU-1' }, offer: { amountMinor: 3990 },
        publication: { state: 'draft' } }] });
  });
});

function renderWithContext(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ConsoleContextProvider value={context}>{node}</ConsoleContextProvider></QueryClientProvider>);
}

function RouteLocation() {
  const location = useLocation();
  return <output hidden data-testid="route-location">{location.pathname}</output>;
}

const scope = { kind: 'mall' as const, id: 'mall:hongtai', name: '宏泰甄选' };
const context: ConsoleContext = {
  session: {
    actor: 'actor:catalog', membership: 'membership:catalog', accessVersion: 8,
    permissions: ['catalog.import.manage', 'catalog.import.read', 'catalog.listing.manage'],
    capabilities: ['catalog.listings.read', 'catalog.imports.create', 'catalog.imports.read',
      'catalog.listings.publish', 'catalog.listings.unpublish'],
    csrf: 'csrf:catalog', target: 'console', scope, scopes: [scope], assurance: { level: 2 },
    syncedAt: '2026-09-07T00:00:00.000Z',
  },
  profile: { display_name: '宏泰商品运营', employee_no: null }, scope, scopes: [scope],
};

const standardPackage = JSON.stringify({
  schema: 'catalog-package/v1', packageId: 'package:test:1', compiledAt: '2026-09-07T00:00:00.000Z',
  source: { name: '测试货盘', file: 'test.json' }, validation: { status: 'passed', errors: [] },
  items: [{ source: { row: 1, productRef: 'P-1', skuRef: 'S-1' },
    product: { title: '测试商品', description: '测试商品描述', category: 'personal', type: 'physical',
      attributes: {}, media: [{ kind: 'image', reference: 'fixture:test-product' }] },
    sku: { code: 'TEST-SKU-1', specifications: { 规格: '标准' } },
    offer: { currency: 'CNY', amountMinor: 9900 }, inventory: { available: 10 }, publication: { state: 'draft' },
    validation: { status: 'valid', errors: [] } }],
});

const importReady = {
  id: 'catalogimport:1', state: 'ready', total_count: 2, cursor_value: 0, success_count: 0, failure_count: 0,
  validation_summary: { format: 'catalog-package/v1', packageId: 'package:test:1', rows: 2, validCount: 1, errorCount: 1 },
  created_at: '2026-09-07T00:00:00.000Z', updated_at: '2026-09-07T00:01:00.000Z', last_error: null,
  preview: [{ rowNumber: 2, title: '测试商品', sku: 'TEST-SKU-1', category: 'personal', priceMinor: '9900', stock: '10', status: 'draft' }],
  errors: [{ row_number: 3, reason_code: 'CATALOG_TITLE_REQUIRED', field: 'product.title', detail: '商品标题必填' }],
};
