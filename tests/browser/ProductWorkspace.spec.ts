import { expect, test, type Page } from '@playwright/test';
import { createConsoleMock } from './ConsoleMock';
import { consoleSession } from './Fixtures';
import type { OperationCall, OperationMock } from './OperationMock';
import { productListing, productPage } from './ProductFixtures';

const productsUrl = 'http://127.0.0.1:4173/scopes/enterprise/enterprise%3Ae2e/products';
const listing = productListing(1, '生产合同商品');
const listingDetail = Object.freeze({
  id: listing.product_id,
  title: listing.title,
  product_type: listing.product_type,
  status: 'active',
  version: '3',
  category_id: 'category:office',
  brand_id: null,
  owner_partner_id: null,
  cover_url: null,
  subtitle: listing.subtitle,
  skus: [],
  listings: [],
  inventory: [],
  prices: [],
});

test('Console 商品治理台按列表与详情合同呈现权威事实和可用操作', async ({ page }) => {
  const api = consoleProductApi(page, () => productPage([listing]));
  await api.install();
  await page.goto(productsUrl);

  await expect(page.getByRole('heading', { level: 1, name: '商品治理台' })).toBeFocused();
  await expect(page.getByRole('button', { name: '商品池', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '导出', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '新建商品', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '待完善' })).toBeEnabled();
  await expect(page.getByRole('combobox', { name: '供应商' })).toBeDisabled();

  const table = page.getByRole('table', { name: '商品列表' });
  await expect(table.locator('tbody tr')).toHaveCount(1);
  const row = table.getByRole('row', { name: /生产合同商品/ });
  await expect(row).toContainText('供应商合同待补');
  await expect(row).toContainText('—');
  await row.getByRole('button', { name: '查看', exact: true }).click();

  const drawer = page.getByRole('dialog', { name: '生产合同商品' });
  await expect(drawer).toBeVisible();
  const tabs = [
    ['概览', '商品概览'],
    ['SKU与库存', 'SKU 与库存'],
    ['商城与售价', '商城与售价'],
    ['来源与供货', '来源与供货'],
    ['变更记录', '当前版本证据'],
  ] as const;
  for (const [label, boundary] of tabs) {
    await drawer.getByRole('tab', { name: label, exact: true }).click();
    await expect(drawer.getByRole('heading', { name: boundary })).toBeVisible();
  }
  await expect(drawer.getByRole('button', { name: '编辑商品' })).toBeEnabled();
  await expect(drawer).not.toContainText('¥219.00');
  await expect(drawer).not.toContainText('1,500');
  await drawer.getByRole('button', { name: '关闭商品详情' }).click();
  await expect(drawer).toBeHidden();

  await row.getByRole('checkbox', { name: '选择 生产合同商品' }).check();
  await expect(page.getByRole('status')).toContainText('已选择当前页 1 项');
  await expect(page.getByRole('button', { name: '批量上架' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '批量下架' })).toBeEnabled();
  expectProductReadsOnly(api);
});

test('Console 商品仅把合同支持的关键词与分类写入查询', async ({ page }) => {
  const api = consoleProductApi(page, (call) => {
    const query = new URLSearchParams(call.query);
    return productPage(query.get('q') === '生产' && query.get('category') === 'category:office' ? [listing] : []);
  });
  await api.install();
  await page.goto(`${productsUrl}?supplier=unsafe&mall=unsafe&status=unsafe&campaign=keep`);

  await expect.poll(() => new URL(page.url()).searchParams.has('supplier')).toBe(false);
  await page.getByRole('textbox', { name: '商品搜索' }).fill('生产');
  await page.getByRole('textbox', { name: '分类编号' }).fill('category:office');
  await page.getByRole('button', { name: '筛选' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('生产');
  await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe('category:office');
  await expect(page.getByText('生产合同商品', { exact: true })).toBeVisible();
  const query = lastProductQuery(api);
  expect(query.get('q')).toBe('生产');
  expect(query.get('category')).toBe('category:office');
  expect(query.has('supplier')).toBe(false);
  expectProductReadsOnly(api);
});

test('Console 商品详情深链只呈现当前授权范围的服务端聚合', async ({ page }) => {
  const api = createConsoleMock(page, consoleSession).get('/api/v1/catalog/products/product1', {
    id: 'product1',
    title: '九阳空气炸锅',
    product_type: 'physical',
    status: 'active',
    version: '8',
    category_id: 'category:appliance',
    brand_id: 'brand:joyoung',
    owner_partner_id: 'partner:authorized',
    cover_url: null,
    subtitle: '服务端商品主档',
    skus: [{ id: 'sku1', code: 'SKU-JY-001', status: 'active', specifications: [{ name: '容量', value: '5.5L' }], version: '3' }],
    listings: [{ id: 'listing1', scope: 'enterprise:e2e', pool: 'pool:authorized', sku: 'sku1', title: '九阳空气炸锅', status: 'published', effectiveAt: '2026-08-30T00:00:00.000Z', expiresAt: null, version: '2' }],
    inventory: [{ sku: 'sku1', scope: 'enterprise:e2e', location: '华东仓', onhand: '1500', safety: '100', status: 'active', version: '4' }],
    prices: [{ sku: 'sku1', scope: 'enterprise:e2e', currency: 'CNY', amountMinor: '21900', compareMinor: '25900', bookStatus: 'active', effectiveAt: '2026-08-30T00:00:00.000Z', expiresAt: null, bookVersion: '5' }],
  });
  await api.install();
  await page.goto(`${productsUrl}/product1`);

  await expect(page.getByRole('heading', { level: 1, name: '商品治理台' })).toBeFocused();
  await expect(page.getByText('九阳空气炸锅 · 服务端商品主档 · product1', { exact: true })).toBeVisible();
  await expect(page.getByText('商品主档来自 Catalog；SKU、商城上架、库存与价格由服务端按 enterprise:e2e 授权范围聚合，只呈现合同允许的字段。')).toBeVisible();
  await expect(page.getByRole('table', { name: '商品 SKU 与规格' })).toContainText('容量：5.5L');
  await expect(page.getByRole('table', { name: '商品商城上架与来源池' })).toContainText('pool:authorized');
  await expect(page.getByRole('table', { name: '商品库存' })).toContainText('1,500');
  await expect(page.getByRole('table', { name: '商品价格' })).toContainText('¥219.00');
  const calls = api.calls.filter((call) => call.path === '/api/v1/catalog/products/product1');
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'enterprise:e2e')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
  expect(api.unmatched).toEqual([]);
});

function consoleProductApi(page: Page, products: (call: OperationCall) => unknown): OperationMock {
  return createConsoleMock(page, consoleSession).get('/api/v1/catalog/listings', products).get('/api/v1/catalog/products/product%3A1', listingDetail);
}

function productCalls(api: OperationMock): readonly OperationCall[] {
  return api.calls.filter((call) => call.path === '/api/v1/catalog/listings');
}

function lastProductQuery(api: OperationMock): URLSearchParams {
  const call = productCalls(api).at(-1);
  expect(call).toBeDefined();
  return new URLSearchParams(call?.query);
}

function expectProductReadsOnly(api: OperationMock): void {
  const calls = productCalls(api);
  expect(calls.length).toBeGreaterThan(0);
  expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'enterprise:e2e')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
  expect(api.calls.filter((call) => call.method !== 'GET')).toEqual([]);
  expect(api.unmatched).toEqual([]);
}
