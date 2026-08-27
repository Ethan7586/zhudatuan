import { expect, test, type Page } from '@playwright/test';
import { consoleSession } from './Fixtures';
import { OperationMock, type OperationCall } from './OperationMock';
<<<<<<< HEAD
import { CONSOLE_ORIGIN } from './Origins';

const productSession = Object.freeze({
  ...consoleSession,
  permissions: Object.freeze([...consoleSession.permissions, 'catalog.listing.read']),
  capabilities: Object.freeze([...consoleSession.capabilities, 'catalog.listings.read']),
});
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

const catalog = Object.freeze(
  Array.from({ length: 5_000 }, (_, index) =>
    Object.freeze({
      id: `listing:${index + 1}`,
      sku_id: `sku:${index + 1}`,
      product_id: `product:${index + 1}`,
      title: `服务端商品 ${String(index + 1).padStart(4, '0')}`,
      status: 'active',
      version: 1,
      cursor_sort: `2026-08-${String(26 - (index % 20)).padStart(2, '0')}T06:00:00.000Z`,
    })
  )
);

test('Console 5000 商品只按服务端游标分页且 DOM 保持单页', async ({ page }) => {
  const api = consoleProductApi(page, productPage);
  await api.install();
<<<<<<< HEAD
  await page.goto(`${CONSOLE_ORIGIN}/scopes/platform/platform%3Ae2e/products`);
=======
  await page.goto('http://127.0.0.1:4173/scopes/platform/platform%3Ae2e/products');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

  await expect(page.getByRole('heading', { level: 1, name: '商品管理' })).toBeFocused();
  await expect(page.getByText('服务端商品 0001', { exact: true })).toBeVisible();
  await expect(page.locator('table tbody tr')).toHaveCount(50);
  expect(productCalls(api).every((call) => new URLSearchParams(call.query).get('limit') === '50')).toBe(true);

  await page.getByRole('button', { name: '下一页' }).click();
  await expect(page).toHaveURL(/cursor=50/);
  await expect(page.getByText('服务端商品 0051', { exact: true })).toBeVisible();
  await expect(page.getByText('服务端商品 0001', { exact: true })).toHaveCount(0);
  await expect(page.locator('table tbody tr')).toHaveCount(50);
  const nextCalls = productCalls(api).filter((call) => new URLSearchParams(call.query).get('cursor') === '50');
  expect(nextCalls.length).toBeGreaterThan(0);
  expect(nextCalls.every((call) => new URLSearchParams(call.query).get('limit') === '50')).toBe(true);
  expect(api.unmatched).toEqual([]);
});

test('Console 迟到筛选响应不得覆盖较新的 URL 查询结果', async ({ page }) => {
  let slowResponded = false;
  const api = consoleProductApi(page, async (call) => {
    const query = new URLSearchParams(call.query);
    if (query.get('q') === 'old') {
      await delay(1_200);
      slowResponded = true;
      return pageOf([catalog[0]!]);
    }
    if (query.get('q') === 'new') return pageOf([{ ...catalog[1]!, title: '新筛选结果 WINNER' }]);
    return pageOf([]);
  });
  await api.install();
<<<<<<< HEAD
  await page.goto(`${CONSOLE_ORIGIN}/scopes/platform/platform%3Ae2e/products?q=old`);
=======
  await page.goto('http://127.0.0.1:4173/scopes/platform/platform%3Ae2e/products?q=old');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  await expect.poll(() => productCalls(api).some((call) => new URLSearchParams(call.query).get('q') === 'old')).toBe(true);

  const search = page.getByLabel('商品搜索');
  await search.fill('new');
  await page.getByRole('button', { name: '筛选' }).click();
  await expect(page).toHaveURL(/q=new/);
  await expect(page.getByText('新筛选结果 WINNER', { exact: true })).toBeVisible();
  await expect.poll(() => slowResponded, { timeout: 3_000 }).toBe(true);
  await expect(page.getByText('新筛选结果 WINNER', { exact: true })).toBeVisible();
  await expect(page.getByText('服务端商品 0001', { exact: true })).toHaveCount(0);
  const terms = new Set(productCalls(api).map((call) => new URLSearchParams(call.query).get('q')));
  expect(terms).toEqual(new Set(['old', 'new']));
});

function consoleProductApi(page: Page, products: (call: OperationCall) => unknown): OperationMock {
<<<<<<< HEAD
  return new OperationMock(page).get('/api/v1/identity/session', productSession).get('/api/v1/members/me', { display_name: '验收管理员', employee_no: 'E2E001' }).get('/api/v1/catalog/listings', products);
=======
  return new OperationMock(page).get('/api/v1/identity/session', consoleSession).get('/api/v1/members/me', { display_name: '验收管理员', employee_no: 'E2E001' }).get('/api/v1/catalog/listings', products);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

function productPage(call: OperationCall) {
  const query = new URLSearchParams(call.query);
  const limit = Number(query.get('limit'));
  const start = Number(query.get('cursor') ?? 0);
  expect(limit).toBe(50);
  return pageOf(catalog.slice(start, start + limit), start + limit < catalog.length ? String(start + limit) : undefined);
}

function pageOf(items: readonly unknown[], nextCursor?: string) {
  return { items, count: items.length, ...(nextCursor === undefined ? {} : { nextCursor }) };
}

function productCalls(api: OperationMock): readonly OperationCall[] {
  return api.calls.filter((call) => call.path === '/api/v1/catalog/listings');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
