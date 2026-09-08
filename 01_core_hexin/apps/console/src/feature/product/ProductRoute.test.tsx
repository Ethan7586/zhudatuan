import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, useLocation } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './ProductRoute';

const requests: URL[] = [];
const writes: string[] = [];
const batchActions: string[] = [];
const server = setupServer(
  http.get('*/api/v1/catalog/listings', ({ request }) => {
    requests.push(new URL(request.url));
    return HttpResponse.json(productPage);
  }),
  http.all('*/api/v1/catalog/**', ({ request }) => {
    writes.push(request.method);
    return HttpResponse.json({ code: 'UNEXPECTED_CATALOG_WRITE' }, { status: 500 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  server.resetHandlers();
  requests.length = 0;
  writes.length = 0;
  batchActions.length = 0;
});
afterAll(() => server.close());

describe('Product governance workspace', () => {
  it('renders the product shell and a stable table skeleton before the cold request completes', async () => {
    server.use(http.get('*/api/v1/catalog/listings', async ({ request }) => {
      requests.push(new URL(request.url));
      await new Promise((resolve) => setTimeout(resolve, 120));
      return HttpResponse.json(productPage);
    }));
    renderProductRoute(mallContext);

    expect(screen.getByRole('heading', { level: 1, name: '商品管理' })).toBeTruthy();
    expect(screen.getByRole('status', { name: '正在加载商品列表' })).toBeTruthy();
    expect(await screen.findByRole('table', { name: '商品列表' })).toBeTruthy();
  });

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

    const access = await screen.findByRole('region', { name: '没有权限' });
    await waitFor(() => expect(document.activeElement).toBe(access));
    expect(within(access).getByText('「商品管理」不可访问')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('table', { name: '商品列表' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: '商品管理' })).toBeNull();
    expect(screen.queryByRole('region', { name: '商品筛选' })).toBeNull();
    expect(screen.queryByText('核心商品')).toBeNull();
    expect(screen.queryByRole('button', { name: '新建商品' })).toBeNull();
  });

  it('exports exactly the loaded page and keeps writes unavailable outside an authorized mall', async () => {
    const user = userEvent.setup();
    const download = captureDownload();
    renderProductRoute();
    await screen.findByRole('table', { name: '商品列表' });
    expect(requests).toHaveLength(1);

    const exportButton = screen.getByRole<HTMLButtonElement>('button', { name: '导出当前页' });
    expect(exportButton.disabled).toBe(false);
    expect(exportButton.title).toBe('仅导出当前已加载页，不包含其他分页');
    await user.click(exportButton);

    expect(download.filenames[0]).toMatch(/^products-current-page-\d{8}-\d{6}\.csv$/);
    expect(csvRowCount(await readBlob(download.blobs[0]!))).toBe(productPage.items.length + 1);
    expect(requests).toHaveLength(1);
    expect(writes).toHaveLength(0);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '新建商品' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '批量导入' }).disabled).toBe(true);
    const release = screen.getByRole<HTMLButtonElement>('button', { name: '一键审核上架 1' });
    expect(release.disabled).toBe(true);
    expect(release.title).toBe('暂不可用：请先切换到商城范围');
    expect(screen.getByText('暂不可用：请先切换到商城范围')).toBeTruthy();
    expect(requests).toHaveLength(1);
  });

  it('shows real SKU quantity and filters the complete management statuses', async () => {
    const user = userEvent.setup();
    server.use(http.get('*/api/v1/catalog/listings', async ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      if (url.searchParams.get('status') !== null) await new Promise((resolve) => setTimeout(resolve, 120));
      return HttpResponse.json(productPage);
    }));
    renderProductRoute(mallContext);
    const table = await screen.findByRole('table', { name: '商品列表' });

    expect(screen.getByText('当前范围内共 4 件商品')).toBeTruthy();
    expect(within(table).getByRole('cell', { name: '3' })).toBeTruthy();
    for (const label of ['待完善', '待审核', '已上架', '已下架']) {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: new RegExp(`^${label}`) }).disabled).toBe(false);
    }

    await user.click(screen.getByRole('button', { name: /^待审核/ }));
    expect(screen.getByRole('table', { name: '商品列表' })).toBeTruthy();
    expect(screen.getByText('正在同步服务端数据…')).toBeTruthy();
    await waitFor(() => expect(requests.some((url) => url.searchParams.get('status') === 'pending_review')).toBe(true));
  });

  it('publishes every ready product with one sequential refresh and no request storm', async () => {
    const user = userEvent.setup();
    let queued = false;
    let completed = false;
    let activeReads = 0;
    let maximumConcurrentReads = 0;
    server.use(http.get('*/api/v1/catalog/listings', async ({ request }) => {
      requests.push(new URL(request.url));
      if (!queued) return HttpResponse.json(productPage);
      activeReads += 1;
      maximumConcurrentReads = Math.max(maximumConcurrentReads, activeReads);
      await new Promise((resolve) => setTimeout(resolve, 900));
      activeReads -= 1;
      if (!completed) return HttpResponse.json(productPage);
      return HttpResponse.json({ ...productPage, status_counts: {
        ...productPage.status_counts, pending_review: 0, published: 2,
      } });
    }));
    server.use(http.post('*/api/v1/catalog/listings/batches', async ({ request }) => {
      const body = await request.json() as { action?: string };
      batchActions.push(body.action ?? '');
      writes.push('POST');
      queued = true;
      return HttpResponse.json({
        id: 'catalogpublication:test',
        action: 'publish_ready',
        state: 'queued',
        items: [],
        count: 0,
      }, { status: 202 });
    }));
    renderProductRoute(mallContext);
    await screen.findByRole('table', { name: '商品列表' });

    const release = screen.getByRole<HTMLButtonElement>('button', { name: '一键审核上架 1' });
    expect(release.disabled).toBe(false);
    expect(release.title).toBe('一次审核并上架当前商城全部合格商品');
    expect(screen.queryByText(/^暂不可用：/)).toBeNull();
    await user.click(release);

    await waitFor(() => expect(batchActions).toEqual(['publish_ready']));
    expect(writes).toContain('POST');
    expect(await screen.findByRole('progressbar')).toBeTruthy();
    expect(screen.getByRole('button', { name: '正在审核上架…' })).toBeTruthy();
    expect(screen.getByText('商品正在发布到前台：0/1')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    completed = true;
    expect(await screen.findByText('已审核并上架 1 件商品，商品管理状态已更新。', {}, { timeout: 2_500 })).toBeTruthy();
    expect(maximumConcurrentReads).toBe(1);
    expect(requests).toHaveLength(2);
  });

  it('enables manual creation, standard-package import and publication in an authorized mall', async () => {
    const user = userEvent.setup();
    server.use(http.delete('*/api/v1/catalog/listings/listing%3A1/publication', () => {
      writes.push('DELETE');
      return HttpResponse.json({ ...productPage.items[0], status: 'unpublished', version: 4 });
    }));
    renderProductRoute(mallContext);
    await screen.findByRole('table', { name: '商品列表' });

    const create = screen.getByRole<HTMLButtonElement>('button', { name: '新建商品' });
    const importing = screen.getByRole<HTMLButtonElement>('button', { name: '批量导入' });
    expect(create.disabled).toBe(false);
    expect(importing.disabled).toBe(false);
    await user.click(create);
    expect(await screen.findByRole('dialog', { name: '新建商品' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(importing);
    expect(await screen.findByRole('dialog', { name: '批量导入商品' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(screen.getByRole('button', { name: '下架 核心商品' }));
    await waitFor(() => expect(writes).toContain('DELETE'));
  });

  it('opens an uploaded import inside the exact mall scope', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/v1/catalog/imports', () => HttpResponse.json({
      id: 'catalogimport:1', state: 'uploaded', total_count: 0, cursor_value: 0, success_count: 0, failure_count: 0,
    })));
    renderProductRoute(mallContext);
    await screen.findByRole('table', { name: '商品列表' });
    await user.click(screen.getByRole('button', { name: '批量导入' }));
    await user.upload(screen.getByLabelText('选择标准货盘包'),
      new File([standardPackage], 'hongtai-products.json', { type: 'application/json' }));
    await screen.findByText('package:test:route');
    await user.click(screen.getByRole('button', { name: '上传并校验' }));

    await waitFor(() => expect(screen.getByTestId('route-location').textContent)
      .toBe('/scopes/mall/mall%3Ahongtai/imports/catalog/catalogimport%3A1'));
  });

  it('downloads an empty loaded page with only the fixed header', async () => {
    server.use(http.get('*/api/v1/catalog/listings', () => HttpResponse.json({ items: [], count: 0 })));
    const user = userEvent.setup();
    const download = captureDownload();
    renderProductRoute();

    const exportButton = await screen.findByRole<HTMLButtonElement>('button', { name: '导出当前页' });
    await waitFor(() => expect(exportButton.disabled).toBe(false));
    await user.click(exportButton);

    const csv = await readBlob(download.blobs[0]!);
    expect(csv.replace(/^\uFEFF/, '')).toBe('记录ID,商品ID,SKU ID,商品编码,商品名称,商品类型,状态,版本,生效时间,失效时间,更新时间\r\n');
    expect(csvRowCount(csv)).toBe(1);
  });
});

function renderProductRoute(value: ConsoleContext = context) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  return render(
    <MemoryRouter initialEntries={['/products']}>
      <QueryClientProvider client={client}>
          <ConsoleContextProvider value={value}>
            <Component />
            <RouteLocation />
          </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function RouteLocation() {
  const location = useLocation();
  return <output hidden data-testid="route-location">{location.pathname}</output>;
}

function captureDownload() {
  const blobs: Blob[] = [];
  const filenames: string[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:product-${blobs.length}`;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function captureFilename(this: HTMLAnchorElement) {
    filenames.push(this.download);
  });
  return { blobs, filenames };
}

async function readBlob(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => typeof reader.result === 'string'
      ? resolve(reader.result) : reject(new Error('BLOB_TEXT_RESULT_REQUIRED')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('BLOB_READ_FAILED')));
    reader.readAsText(blob);
  });
}

function csvRowCount(csv: string): number {
  return csv.split('\r\n').filter((line) => line !== '').length;
}

const productPage = {
  items: [{
    id: 'listing:1',
    sku_id: 'sku:1',
    product_id: 'product:1',
    title: '核心商品',
    status: 'published',
    management_status: 'published',
    sku_count: 3,
    version: 3,
  }],
  count: 1,
  total_count: 4,
  status_counts: { needs_attention: 1, pending_review: 1, published: 1, unpublished: 1 },
};

const standardPackage = JSON.stringify({
  schema: 'catalog-package/v1', packageId: 'package:test:route', compiledAt: '2026-09-07T00:00:00.000Z',
  source: { name: '测试货盘', file: 'test.json' }, validation: { status: 'passed', errors: [] },
  items: [{ source: { row: 1, productRef: 'P-1', skuRef: 'S-1' },
    product: { title: '测试商品', description: '测试商品描述', category: 'personal', type: 'physical',
      attributes: {}, media: [{ kind: 'image', reference: 'fixture:test-product' }] },
    sku: { code: 'TEST-SKU-ROUTE', specifications: { 规格: '标准' } },
    offer: { currency: 'CNY', amountMinor: 9900 }, inventory: { available: 10 }, publication: { state: 'draft' },
    validation: { status: 'valid', errors: [] } }],
});

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

const mallScope = { kind: 'mall' as const, id: 'mall:hongtai', name: '宏泰甄选' };
const mallContext: ConsoleContext = {
  ...context,
  session: {
    ...context.session,
    csrf: 'csrf:catalog',
    permissions: ['catalog.import.manage', 'catalog.import.read', 'catalog.listing.manage'],
    capabilities: ['catalog.listings.read', 'catalog.imports.create', 'catalog.imports.read',
      'catalog.listings.publish', 'catalog.listings.unpublish', 'catalog.listings.batch'],
    scope: mallScope,
    scopes: [mallScope],
  },
  scope: mallScope,
  scopes: [mallScope],
};
