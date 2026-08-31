import { expect, test, type Page } from '@playwright/test';
import { createConsoleMock } from './ConsoleMock';
import { consoleSession } from './Fixtures';
import { orderRecord } from './OrderFixtures';
import type { OperationCall, OperationMock } from './OperationMock';

const ordersUrl = 'http://127.0.0.1:4173/scopes/enterprise/enterprise%3Ae2e/orders';
const orders = Object.freeze(Array.from({ length: 55 }, (_, index) => orderRecord(index + 1, `权威商品 ${index + 1}`)));

test('Console 订单列表只保留单页 DOM 并以服务端游标前进', async ({ page }) => {
  const api = consoleOrderApi(page, orderPage);
  await api.install();
  await page.goto(ordersUrl);

  const table = page.getByRole('table', { name: '订单列表' });
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(table.getByText(orders[0]!.order_number, { exact: true })).toBeVisible();
  await expect(page.getByText('本页 50 条 · 全量总数不可用', { exact: true })).toBeVisible();
  expect(orderCalls(api).every((call) => new URLSearchParams(call.query).get('limit') === '50')).toBe(true);

  await page.getByRole('button', { name: '下一页' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('cursor')).toBe('orders:50');
  await expect(table.locator('tbody tr')).toHaveCount(5);
  await expect(table.getByText(orders[50]!.order_number, { exact: true })).toBeVisible();
  await expect(table.getByText(orders[0]!.order_number, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下一页' })).toBeDisabled();
  expectOrderReadsOnly(api);
});

test('Console 迟到订单响应不得覆盖更新的 URL 查询', async ({ page }) => {
  let slowResponded = false;
  const oldOrder = orderRecord(101, '迟到旧筛选商品');
  const newOrder = orderRecord(102, '新筛选结果商品');
  const api = consoleOrderApi(page, async (call) => {
    const query = new URLSearchParams(call.query);
    if (query.get('order') === 'old') {
      await delay(1_200);
      slowResponded = true;
      return { items: [oldOrder], count: 1 };
    }
    if (query.get('order') === 'new') return { items: [newOrder], count: 1 };
    return { items: [], count: 0 };
  });
  await api.install();
  await page.goto(`${ordersUrl}?order=old`);
  await expect.poll(() => orderCalls(api).some((call) => new URLSearchParams(call.query).get('order') === 'old')).toBe(true);

  await page.getByRole('textbox', { name: '订单搜索' }).fill('new');
  await page.getByRole('button', { name: '筛选订单' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('order')).toBe('new');
  await expect(page.getByText('新筛选结果商品', { exact: true })).toBeVisible();
  await expect.poll(() => slowResponded, { timeout: 3_000 }).toBe(true);
  await expect(page.getByText('新筛选结果商品', { exact: true })).toBeVisible();
  await expect(page.getByText('迟到旧筛选商品', { exact: true })).toHaveCount(0);
  expectOrderReadsOnly(api);
});

function orderPage(call: OperationCall) {
  const query = new URLSearchParams(call.query);
  const offset = query.get('cursor') === null ? 0 : Number(query.get('cursor')?.replace('orders:', ''));
  const items = orders.slice(offset, offset + 50);
  return Object.freeze({ items, count: items.length, ...(offset + items.length < orders.length ? { nextCursor: `orders:${offset + items.length}` } : {}) });
}

function consoleOrderApi(page: Page, responder: (call: OperationCall) => unknown): OperationMock {
  return createConsoleMock(page, consoleSession).get('/api/v1/orders', responder);
}

function orderCalls(api: OperationMock): readonly OperationCall[] {
  return api.calls.filter((call) => call.path === '/api/v1/orders');
}

function expectOrderReadsOnly(api: OperationMock): void {
  const calls = orderCalls(api);
  expect(calls.length).toBeGreaterThan(0);
  expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'enterprise:e2e')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
  expect(api.unmatched).toEqual([]);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
