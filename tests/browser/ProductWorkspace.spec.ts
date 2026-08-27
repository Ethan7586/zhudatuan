import { expect, test, type Page } from '@playwright/test';
import { consoleSession } from './Fixtures';
import { OperationMock, type OperationCall } from './OperationMock';
<<<<<<< HEAD
import { CONSOLE_ORIGIN } from './Origins';
import { productPreviewPage } from './ProductPreviewFixtures';

const previewScope = Object.freeze({ kind: 'platform', id: 'platform:preview', name: '鸿泰集团' });
const productSession = Object.freeze({
  ...consoleSession,
  permissions: Object.freeze([...consoleSession.permissions, 'catalog.listing.read']),
  capabilities: Object.freeze([...consoleSession.capabilities, 'catalog.listings.read']),
});
const previewSession = Object.freeze({ ...productSession, scope: previewScope, scopes: [previewScope] });
=======
import { productPreviewPage } from './ProductPreviewFixtures';

const previewScope = Object.freeze({ kind: 'platform', id: 'platform:preview', name: '鸿泰集团' });
const previewSession = Object.freeze({ ...consoleSession, scope: previewScope, scopes: [previewScope] });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

test('Console 商品工作台只在平台预览 Scope 展示演示详情并保持写操作关闭', async ({ page }) => {
  const api = consoleProductApi(page, previewSession, (call: OperationCall) => productPreviewPage(new URLSearchParams(call.query)));
  await api.install();
<<<<<<< HEAD
  await page.goto(`${CONSOLE_ORIGIN}/scopes/platform/platform%3Apreview/products`);
=======
  await page.goto('http://127.0.0.1:4173/scopes/platform/platform%3Apreview/products');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

  await expect(page.getByRole('heading', { level: 1, name: '商品管理' })).toBeFocused();
  await expect(page.getByText('当前范围内共 5,008 件核心商品', { exact: true })).toBeVisible();
  await expect(page.getByText('1–50 / 共 5,008 件', { exact: true })).toBeVisible();
  const table = page.getByRole('table', { name: '商品列表' });
  await expect(table.locator('tbody tr')).toHaveCount(50);

<<<<<<< HEAD
  const importButton = page.getByRole('button', { name: '导入', exact: true });
  await expect(importButton).toBeEnabled();
  await importButton.click();
  const importDialog = page.getByRole('dialog', { name: '导入商品' });
  await expect(importDialog.getByText('选择本地 CSV 文件预览商品导入交互；本期不会上传文件。', { exact: true })).toBeVisible();
  await importDialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(importDialog).toBeHidden();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出当前页', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^products-current-page-.*\.csv$/);
=======
  await expect(page.getByRole('button', { name: '导入', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '导出', exact: true })).toBeDisabled();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  await expect(page.getByRole('button', { name: '新建商品', exact: true })).toBeDisabled();

  const jiuyangRow = table.getByRole('row', { name: /九阳5\.5L大容量可视空气炸锅/ });
  await jiuyangRow.getByRole('button', { name: '查看', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '九阳5.5L大容量可视空气炸锅' });
  await expect(drawer).toBeVisible();
  for (const label of ['概览', 'SKU与库存', '商城与售价', '来源与供货', '变更记录']) {
    const tab = drawer.getByRole('tab', { name: label, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
  await drawer.getByRole('tab', { name: '概览', exact: true }).click();
  await drawer.getByRole('button', { name: '去处理', exact: true }).click();
  await expect(drawer.getByRole('tab', { name: '商城与售价', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(drawer.getByRole('button', { name: '编辑商品', exact: true })).toBeDisabled();
  await drawer.getByRole('button', { name: '关闭商品详情', exact: true }).click();
  await expect(drawer).toBeHidden();

  await jiuyangRow.getByRole('checkbox', { name: '选择 九阳5.5L大容量可视空气炸锅', exact: true }).check();
  await expect(page.getByRole('button', { name: '批量执行', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '预览影响', exact: true }).click();
  const batch = page.getByRole('dialog', { name: '批量操作影响预览' });
  await expect(batch).toBeVisible();
  await expect(batch.getByText('当前只预览本页明确勾选的 1 项，不会把它们冒充当前筛选下的全部商品。', { exact: true })).toBeVisible();
  await expect(batch.getByRole('button', { name: '创建 Operation', exact: true })).toBeDisabled();
  await batch.getByRole('button', { name: '返回列表', exact: true }).click();
  await expect(batch).toBeHidden();

  await page.getByRole('button', { name: /待完善/ }).click();
  await expect(page).toHaveURL(/status=needs_attention/);
  await expect.poll(() => productCalls(api).some((call) => new URLSearchParams(call.query).get('status') === 'needs_attention')).toBe(true);

  const calls = productCalls(api);
  expect(calls.length).toBeGreaterThanOrEqual(2);
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'platform:preview')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
  expect(api.calls.filter((call) => call.method !== 'GET')).toEqual([]);
  expect(api.unmatched).toEqual([]);
});

test('Console 生产列表快照不得泄漏本地预览价格库存与供应商', async ({ page }) => {
<<<<<<< HEAD
  const api = consoleProductApi(page, productSession, {
=======
  const api = consoleProductApi(page, consoleSession, {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    items: [
      {
        id: 'listing:production:1',
        sku_id: 'sku:production:1',
        product_id: 'product:production:1',
        title: '生产合同裸商品',
        status: 'published',
        version: 3,
        code: 'SKU-PRODUCTION-1',
        cursor_sort: '2026-08-26T06:00:00.000Z',
      },
    ],
    count: 1,
  });
  await api.install();
<<<<<<< HEAD
  await page.goto(`${CONSOLE_ORIGIN}/scopes/platform/platform%3Ae2e/products`);
=======
  await page.goto('http://127.0.0.1:4173/scopes/platform/platform%3Ae2e/products');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

  const table = page.getByRole('table', { name: '商品列表' });
  await expect(table.locator('tbody tr')).toHaveCount(1);
  const row = table.getByRole('row', { name: /生产合同裸商品/ });
  await row.getByRole('button', { name: '查看', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '生产合同裸商品' });
  await expect(drawer.getByText('商品概览合同待补齐', { exact: true })).toBeVisible();
  await expect(drawer).not.toContainText('¥219.00');
  await expect(drawer).not.toContainText('1,500');
  await expect(drawer).not.toContainText('央企供应链');

  const calls = productCalls(api);
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'platform:e2e')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
  expect(api.calls.filter((call) => call.method !== 'GET')).toEqual([]);
  expect(api.unmatched).toEqual([]);
});

function consoleProductApi(page: Page, session: unknown, products: unknown): OperationMock {
  return new OperationMock(page).get('/api/v1/identity/session', session).get('/api/v1/members/me', { display_name: '验收管理员', employee_no: 'E2E001' }).get('/api/v1/catalog/listings', products);
}

function productCalls(api: OperationMock): readonly OperationCall[] {
  return api.calls.filter((call) => call.path === '/api/v1/catalog/listings');
}
