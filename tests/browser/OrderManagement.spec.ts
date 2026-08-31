import { expect, test, type Page } from '@playwright/test';
import { createConsoleMock } from './ConsoleMock';
import { consoleSession } from './Fixtures';
import { orderRead, orderRecord } from './OrderFixtures';
import type { OperationCall, OperationMock } from './OperationMock';

const ordersUrl = 'http://127.0.0.1:4173/scopes/enterprise/enterprise%3Ae2e/orders';
const order = orderRecord();

test('Console 订单管理只呈现生产权威字段和服务端精确筛选', async ({ page }) => {
  const api = consoleOrderApi(page, (call) => orderRead(call));
  await api.install();
  await page.goto(ordersUrl);

  await expect(page.getByRole('heading', { level: 1, name: '订单管理' })).toBeFocused();
  await expect(page).toHaveTitle('订单管理 · 智慧翼');
  await expect(page.getByRole('note')).toContainText('仅支持内部订单 ID 精确筛选与游标分页');
  await expect(page.getByRole('button', { name: '导出订单' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '更多筛选' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: '支付状态' })).toBeDisabled();

  const table = page.getByRole('table', { name: '订单列表' });
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.getByText(order.order_number, { exact: true })).toBeVisible();
  await expect(table.getByText('权威商品标题', { exact: true })).toBeVisible();
  await expect(table.getByText('未提供', { exact: true })).toBeVisible();
  await expect(page.getByText('本页 1 条 · 全量总数不可用', { exact: true })).toBeVisible();

  const search = page.getByRole('textbox', { name: '订单搜索' });
  await search.fill(order.id);
  await page.getByRole('button', { name: '筛选订单' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('order')).toBe(order.id);
  await expect(table.locator('tbody tr')).toHaveCount(1);
  expect(lastOrderQuery(api).get('order')).toBe(order.id);
  expect(lastOrderQuery(api).get('limit')).toBe('50');
  expectOrderReadsOnly(api);
});

test('Console 订单抽屉由内部 ID URL 驱动且五个页签均不伪造事实', async ({ page }) => {
  const api = consoleOrderApi(page, (call) => orderRead(call));
  await api.install();
  await page.goto(`${ordersUrl}?campaign=keep`);
  await page.getByRole('button', { name: `查看订单 ${order.order_number}` }).click();

  await expect.poll(() => new URL(page.url()).searchParams.get('selected')).toBe(order.id);
  const drawer = page.getByRole('dialog', { name: `订单详情 ${order.order_number}` });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(/最终动作保持关闭/)).toBeVisible();
  await expect(drawer.getByRole('button', { name: '更多' })).toBeDisabled();
  await expect(drawer.getByRole('button', { name: '确认发货' })).toBeDisabled();
  const tabJourneys = [
    ['商品与履约', 'products', '商品与履约快照'],
    ['支付与退款', 'payment', '支付快照'],
    ['售后', 'aftersale', '售后状态'],
    ['操作记录', 'operations', '最近 Operation'],
    ['订单概览', 'overview', '金额与支付'],
  ] as const;
  for (const [label, key, heading] of tabJourneys) {
    await drawer.getByRole('tab', { name: label }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe(key);
    await expect(drawer.getByRole('heading', { name: heading })).toBeVisible();
  }
  expect(
    orderCalls(api).some((call) => {
      const query = new URLSearchParams(call.query);
      return query.get('limit') === '1' && query.get('order') === order.id;
    })
  ).toBe(true);

  await drawer.getByRole('button', { name: '关闭订单详情' }).click();
  await expect(drawer).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.has('selected')).toBe(false);
  await expect.poll(() => new URL(page.url()).searchParams.get('campaign')).toBe('keep');
  expectOrderReadsOnly(api);
});

test('Console 订单复选与列设置保持本地且不触发写请求', async ({ page }) => {
  const api = consoleOrderApi(page, (call) => orderRead(call));
  await api.install();
  await page.goto(ordersUrl);

  const checkbox = page.getByRole('checkbox', { name: `选择订单 ${order.order_number}` });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await expect(page.getByRole('status')).toContainText('已选择 1 条当前页订单');
  expect(new URL(page.url()).searchParams.has('selected')).toBe(false);

  await page.getByRole('button', { name: '列设置' }).click();
  const settings = page.getByRole('region', { name: '订单列表列设置' });
  const productColumn = settings.getByRole('checkbox', { name: '商品摘要' });
  await productColumn.uncheck();
  await expect(page.getByRole('columnheader', { name: '商品摘要' })).toHaveCount(0);
  await settings.getByRole('button', { name: '完成' }).click();
  await expect(settings).toBeHidden();
  expect(api.calls.filter((call) => call.method !== 'GET')).toEqual([]);
  expectOrderReadsOnly(api);
});

function consoleOrderApi(page: Page, orders: (call: OperationCall) => unknown): OperationMock {
  return createConsoleMock(page, consoleSession).get('/api/v1/orders', orders);
}

function orderCalls(api: OperationMock): readonly OperationCall[] {
  return api.calls.filter((call) => call.path === '/api/v1/orders');
}

function lastOrderQuery(api: OperationMock): URLSearchParams {
  const call = orderCalls(api).at(-1);
  expect(call).toBeDefined();
  return new URLSearchParams(call?.query);
}

function expectOrderReadsOnly(api: OperationMock): void {
  const calls = orderCalls(api);
  expect(calls.length).toBeGreaterThan(0);
  expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'enterprise:e2e')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
  expect(api.unmatched).toEqual([]);
}
