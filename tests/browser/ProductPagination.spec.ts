import { expect, test, type Page } from '@playwright/test';
import { createConsoleMock } from './ConsoleMock';
import { consoleSession } from './Fixtures';
import type { OperationCall, OperationMock } from './OperationMock';
import { productListing, productPage } from './ProductFixtures';

const productsUrl = 'http://127.0.0.1:4173/scopes/enterprise/enterprise%3Ae2e/products';
const catalog = Object.freeze(Array.from({ length: 105 }, (_, index) => productListing(index + 1)));

test('Console 商品只按服务端游标分页且 DOM 保持单页', async ({ page }) => {
  const api = consoleProductApi(page, catalogPage);
  await api.install();
  await page.goto(productsUrl);

  const table = page.getByRole('table', { name: '商品列表' });
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText(catalog[0]!.title, { exact: true })).toBeVisible();
  await expect(page.getByText('本页 50 件 · 总量暂不可用', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '下一页' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('cursor')).toBe('products:50');
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText(catalog[50]!.title, { exact: true })).toBeVisible();
  await expect(page.getByText(catalog[0]!.title, { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '上一页' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has('cursor')).toBe(false);
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText(catalog[0]!.title, { exact: true })).toBeVisible();
  expectProductReadsOnly(api);
});

test('Console 迟到商品响应不得覆盖更新的 URL 查询', async ({ page }) => {
  let slowResponded = false;
  const oldProduct = productListing(201, '迟到旧商品 LOSER');
  const newProduct = productListing(202, '新筛选结果 WINNER');
  const api = consoleProductApi(page, async (call) => {
    const query = new URLSearchParams(call.query);
    if (query.get('q') === 'old') {
      await delay(1_200);
      slowResponded = true;
      return productPage([oldProduct]);
    }
    if (query.get('q') === 'new') return productPage([newProduct]);
    return productPage([]);
  });
  await api.install();
  await page.goto(`${productsUrl}?q=old`);
  await expect.poll(() => productCalls(api).some((call) => new URLSearchParams(call.query).get('q') === 'old')).toBe(true);

  await page.getByRole('textbox', { name: '商品搜索' }).fill('new');
  await page.getByRole('button', { name: '筛选' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('new');
  await expect(page.getByText('新筛选结果 WINNER', { exact: true })).toBeVisible();
  await expect.poll(() => slowResponded, { timeout: 3_000 }).toBe(true);
  await expect(page.getByText('新筛选结果 WINNER', { exact: true })).toBeVisible();
  await expect(page.getByText('迟到旧商品 LOSER', { exact: true })).toHaveCount(0);
  expectProductReadsOnly(api);
});

function catalogPage(call: OperationCall) {
  const query = new URLSearchParams(call.query);
  const limit = Number(query.get('limit'));
  const cursor = query.get('cursor');
  const offset = cursor === null ? 0 : Number(cursor.replace('products:', ''));
  const items = catalog.slice(offset, offset + limit);
  return productPage(items, offset + items.length < catalog.length ? `products:${offset + items.length}` : undefined);
}

function consoleProductApi(page: Page, products: (call: OperationCall) => unknown): OperationMock {
  return createConsoleMock(page, consoleSession).get('/api/v1/catalog/listings', products);
}

function productCalls(api: OperationMock): readonly OperationCall[] {
  return api.calls.filter((call) => call.path === '/api/v1/catalog/listings');
}

function expectProductReadsOnly(api: OperationMock): void {
  const calls = productCalls(api);
  expect(calls.length).toBeGreaterThan(0);
  expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'enterprise:e2e')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
  expect(api.unmatched).toEqual([]);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
