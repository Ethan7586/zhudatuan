import { expect, test, type Page } from '@playwright/test';
import { consoleSession } from './Fixtures';
import { OperationMock, type OperationCall } from './OperationMock';
import { ORDER_PREVIEW_TOTAL, orderPaginationOrders, orderPreviewOrders, orderPreviewPage, type OrderPreviewRecord } from './OrderPreviewFixtures';
<<<<<<< HEAD
<<<<<<< HEAD
import { CONSOLE_ORIGIN } from './Origins';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { CONSOLE_ORIGIN } from './Origins';
>>>>>>> 05ea98a5 (fix(release): restore selected app verification)

const previewScope = Object.freeze({ kind: 'platform', id: 'platform:preview', name: '本地预览平台' });
const previewSession = Object.freeze({
  ...consoleSession,
  scope: previewScope,
  scopes: Object.freeze([previewScope]),
<<<<<<< HEAD
<<<<<<< HEAD
  permissions: Object.freeze([...consoleSession.permissions, 'order.read']),
  capabilities: Object.freeze([...consoleSession.capabilities, 'order.orders.read']),
});
const ordersUrl = `${CONSOLE_ORIGIN}/scopes/platform/platform%3Apreview/orders`;
=======
});
const ordersUrl = 'http://127.0.0.1:4173/scopes/platform/platform%3Apreview/orders';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  permissions: Object.freeze([...consoleSession.permissions, 'order.read']),
  capabilities: Object.freeze([...consoleSession.capabilities, 'order.orders.read']),
});
const ordersUrl = `${CONSOLE_ORIGIN}/scopes/platform/platform%3Apreview/orders`;
>>>>>>> 05ea98a5 (fix(release): restore selected app verification)

test('Console 5000 订单只按服务端游标分页且 DOM 保持单页', async ({ page }) => {
  const api = consoleOrderApi(page, (call) => orderPreviewPage(new URLSearchParams(call.query), orderPaginationOrders));
  await api.install();
  await page.goto(ordersUrl);

  const table = page.getByRole('table', { name: '订单列表' });
  await expect(page.getByRole('heading', { level: 1, name: '订单管理系统' })).toBeVisible();
  await expect(table.getByText('SW202608240001', { exact: true })).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText(`1–50 / 共 ${ORDER_PREVIEW_TOTAL} 笔`, { exact: true })).toBeVisible();
  expect(orderCalls(api).every((call) => new URLSearchParams(call.query).get('limit') === '50')).toBe(true);

  await page.getByRole('button', { name: '下一页' }).click();
  await expect(page).toHaveURL(/cursor=/);
  await expect(table.getByText('SW-PREVIEW-00051', { exact: true })).toBeVisible();
  await expect(table.getByText('SW202608240001', { exact: true })).toHaveCount(0);
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText(`51–100 / 共 ${ORDER_PREVIEW_TOTAL} 笔`, { exact: true })).toBeVisible();
  const cursorCalls = orderCalls(api).filter((call) => new URLSearchParams(call.query).has('cursor'));
  expect(cursorCalls.length).toBeGreaterThan(0);
  expect(cursorCalls.every((call) => new URLSearchParams(call.query).get('limit') === '50')).toBe(true);

  await page.getByRole('button', { name: '上一页' }).click();
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(table.getByText('SW202608240001', { exact: true })).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(50);
  expectOrderReadsOnly(api);
  expect(api.unmatched).toEqual([]);
});

test('Console 迟到的旧订单 URL 响应不得覆盖较新的筛选结果', async ({ page }) => {
  let slowResponded = false;
  const oldOrder = renamedOrder(orderPreviewOrders[0]!, '迟到旧订单 LOSER', '迟到旧筛选商品');
  const newOrder = renamedOrder(orderPreviewOrders[1]!, '新筛选结果 WINNER', '新筛选结果商品');
  const api = consoleOrderApi(page, async (call) => {
    const query = new URLSearchParams(call.query);
    if (query.get('order') === 'old') {
      await delay(1_200);
      slowResponded = true;
      return orderPreviewPage(new URLSearchParams('limit=50'), [oldOrder]);
    }
    if (query.get('order') === 'new') return orderPreviewPage(new URLSearchParams('limit=50'), [newOrder]);
    return orderPreviewPage(new URLSearchParams('limit=50'), []);
  });
  await api.install();
  await page.goto(`${ordersUrl}?order=old`);
  await expect.poll(() => orderCalls(api).some((call) => new URLSearchParams(call.query).get('order') === 'old')).toBe(true);

  await page.getByLabel('订单搜索').fill('new');
  await page.getByRole('button', { name: '筛选订单' }).click();
  await expect(page).toHaveURL(/order=new/);
  await expect(page.getByText('新筛选结果 WINNER', { exact: true })).toBeVisible();
  await expect.poll(() => slowResponded, { timeout: 3_000 }).toBe(true);
  await expect(page.getByText('新筛选结果 WINNER', { exact: true })).toBeVisible();
  await expect(page.getByText('迟到旧订单 LOSER', { exact: true })).toHaveCount(0);
  const terms = new Set(orderCalls(api).map((call) => new URLSearchParams(call.query).get('order')));
  expect(terms).toEqual(new Set(['old', 'new']));
  expectOrderReadsOnly(api);
  expect(api.unmatched).toEqual([]);
});

function consoleOrderApi(page: Page, orders: (call: OperationCall) => unknown): OperationMock {
  return new OperationMock(page).get('/api/v1/identity/session', previewSession).get('/api/v1/members/me', { display_name: '验收管理员', employee_no: 'E2E001' }).get('/api/v1/orders', orders);
}

function renamedOrder(source: OrderPreviewRecord, orderNumber: string, productTitle: string): OrderPreviewRecord {
  const firstLine = source.lines[0]!;
  return Object.freeze({
    ...source,
    order_number: orderNumber,
    lines: Object.freeze([Object.freeze({ ...firstLine, title: productTitle })]),
  });
}

function orderCalls(api: OperationMock): readonly OperationCall[] {
  return api.calls.filter((call) => call.path.startsWith('/api/v1/orders'));
}

function expectOrderReadsOnly(api: OperationMock): void {
  const calls = orderCalls(api);
  expect(calls.length).toBeGreaterThan(0);
  expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
  expect(new Set(calls.map((call) => call.path))).toEqual(new Set(['/api/v1/orders']));
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'platform:preview')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
