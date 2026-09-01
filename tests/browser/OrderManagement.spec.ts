import { expect, test, type Locator, type Page } from '@playwright/test';
import { consoleSession } from './Fixtures';
import { OperationMock, type OperationCall } from './OperationMock';
import { orderPreviewPage } from './OrderPreviewFixtures';
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

test('Console 订单管理呈现参考结构并只用服务端筛选结果', async ({ page }) => {
  const api = consoleOrderApi(page, (call) => orderPreviewPage(new URLSearchParams(call.query)));
  await api.install();
  await page.goto(ordersUrl);

  await expect(page.getByRole('heading', { level: 1, name: '订单管理系统' })).toBeVisible();
<<<<<<< HEAD
  await expect(page).toHaveTitle('订单管理 · 主打团');
  await expect(page.getByText('ORDER OPERATIONS', { exact: true })).toBeVisible();
  await expect(page.getByText('统一处理订单、支付、履约、退款与售后', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出当前页' })).toBeEnabled();
=======
  await expect(page).toHaveTitle('订单管理 · 智慧翼');
  await expect(page.getByText('ORDER OPERATIONS', { exact: true })).toBeVisible();
  await expect(page.getByText('统一处理订单、支付、履约、退款与售后', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出订单' })).toBeEnabled();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  await expect(page.getByRole('button', { name: '刷新数据' })).toBeEnabled();
  await expect(page.getByRole('button', { name: /全部订单\s*7/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /异常\s*1/ })).toBeVisible();

  const table = page.getByRole('table', { name: '订单列表' });
  await expect(table.getByRole('columnheader')).toHaveText(['', '订单 / 时间', '会员 / 企业', '商品摘要', '金额 / 支付', '履约状态', '售后', 'SLA', '操作']);
  await expect(table.locator('tbody tr')).toHaveCount(7);
  await expect(table.getByText('五常大米礼盒', { exact: true })).toBeVisible();
  await expect(page.getByText(/服务端实时筛选/)).toBeVisible();
  await expect(page.getByRole('button', { name: '更多筛选' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '列设置' })).toBeEnabled();
  await expect(page.getByLabel('每页数量')).toBeDisabled();

  const search = page.getByLabel('订单搜索');
  await search.focus();
  expect(await search.evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe('none');

  await search.fill('五常大米');
  await page.getByRole('button', { name: '筛选订单' }).click();
  await expect(page).toHaveURL(/order=%E4%BA%94%E5%B8%B8%E5%A4%A7%E7%B1%B3/);
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.getByText('SW202608240001', { exact: true })).toBeVisible();
  expect(lastOrderQuery(api).get('order')).toBe('五常大米');
  expect(lastOrderQuery(api).get('limit')).toBe('50');

  await page.getByRole('button', { name: '重置' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(7);
  await page.getByRole('combobox', { name: '下单时间', exact: true }).selectOption('today');
  await page.getByRole('combobox', { name: '订单状态', exact: true }).selectOption('active');
  await page.getByRole('combobox', { name: '支付状态', exact: true }).selectOption('paid');
  await page.getByRole('combobox', { name: '履约状态', exact: true }).selectOption('allocated');
  await page.getByRole('combobox', { name: '商城范围', exact: true }).selectOption('huimin');
  await page.getByRole('button', { name: '筛选订单' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  const filteredQuery = lastOrderQuery(api);
  expect(Object.fromEntries(filteredQuery.entries())).toMatchObject({
    placed: 'today',
    lifecycle: 'active',
    payment: 'paid',
    fulfillment: 'allocated',
    mall: 'huimin',
    limit: '50',
  });

  await page.getByRole('button', { name: '重置' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(7);
  await page.getByRole('button', { name: /待付款\s*1/ }).click();
  await expect(page).toHaveURL(/view=unpaid/);
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.getByText('九阳5.5L大容量可视空气炸锅', { exact: true })).toBeVisible();
  expect(lastOrderQuery(api).get('view')).toBe('unpaid');

  expectOrderReadsOnly(api);
  expect(api.unmatched).toEqual([]);
});

test('Console 订单抽屉由 selected URL 驱动且最终动作失败关闭', async ({ page }) => {
  const api = consoleOrderApi(page, (call) => orderPreviewPage(new URLSearchParams(call.query)));
  await api.install();
  await page.goto(ordersUrl);
  await expect(page.getByRole('table', { name: '订单列表' }).locator('tbody tr')).toHaveCount(7);

  const readsBeforeRefresh = orderCalls(api).length;
  await page.getByRole('button', { name: '刷新数据' }).click();
  await expect.poll(() => orderCalls(api).length).toBeGreaterThan(readsBeforeRefresh);

  await page.getByRole('button', { name: '查看订单 SW202608240001' }).click();
  await expect(page).toHaveURL(/selected=order%3Apreview%3A00001/);
  const drawer = page.getByRole('dialog', { name: '订单详情 SW202608240001' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading', { level: 2, name: 'SW202608240001' })).toBeVisible();
  await expect(drawer.locator('.orderdrawerheader').getByText('鸿泰惠民通', { exact: false })).toBeVisible();
  await expect(drawer.getByRole('list', { name: '订单状态链' }).locator('strong')).toHaveText(['下单', '支付', '库存锁定', '待发货', '待收货', '完成']);
  await expect(drawer.getByText(/最近 Operation/)).toContainText('OP-240824-1185');

  const tabs = drawer.getByRole('tablist', { name: '订单详情分类' }).getByRole('tab');
  await expect(tabs).toHaveText(['订单概览', '商品与履约', '支付与退款', '售后', '操作记录']);
  const tabJourneys = [
    ['商品与履约', 'products', '商品与履约快照'],
    ['支付与退款', 'payment', '支付快照'],
    ['售后', 'aftersale', '售后状态'],
    ['操作记录', 'operations', '最近 Operation'],
    ['订单概览', 'overview', '商品明细'],
  ] as const;
  for (const [label, key, content] of tabJourneys) {
    await drawer.getByRole('tab', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`tab=${key}`));
    await expect(drawer.getByRole('heading', { name: content })).toBeVisible();
  }

  await page.reload();
  await expect(page).toHaveURL(/selected=order%3Apreview%3A00001.*tab=overview/);
  await expect(drawer).toBeVisible();

<<<<<<< HEAD
  await expect(page.getByRole('button', { name: '导出当前页' })).toBeEnabled();
=======
  await expect(page.getByRole('button', { name: '导出订单' })).toBeEnabled();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  await expect(drawer.getByRole('button', { name: '确认发货' })).toBeEnabled();
  await expect(drawer.getByRole('button', { name: '更多', exact: true })).toBeEnabled();
  const detailRead = orderCalls(api).find((call) => new URLSearchParams(call.query).get('limit') === '1');
  expect(detailRead).toBeDefined();
  expect(new URLSearchParams(detailRead?.query).get('order')).toBe('order:preview:00001');

  await drawer.getByRole('button', { name: '关闭订单详情' }).click();
  await expect(page).not.toHaveURL(/selected=/);
  await expect(drawer).toBeHidden();

  await page.goBack();
  await expect(page).toHaveURL(/selected=order%3Apreview%3A00001/);
  await expect(page.getByRole('dialog', { name: '订单详情 SW202608240001' })).toBeVisible();
  await page.goForward();
  await expect(page).not.toHaveURL(/selected=/);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  expectOrderReadsOnly(api);
  expect(api.unmatched).toEqual([]);
});

test('Console 订单预览操作全部可点击、可关闭且不会发送写请求', async ({ page }) => {
  const api = consoleOrderApi(page, (call) => orderPreviewPage(new URLSearchParams(call.query)));
  await api.install();
  await page.goto(ordersUrl);
  const table = page.getByRole('table', { name: '订单列表' });
  await expect(table.locator('tbody tr')).toHaveCount(7);

<<<<<<< HEAD
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出当前页' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^orders-current-page-.*\.csv$/);
=======
  await openAndCloseSafePreview(page, page.getByRole('button', { name: '导出订单' }), '导出订单预览');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  await openAndCloseSafePreview(page, page.getByRole('button', { name: '更多筛选' }), '更多筛选');
  await openAndCloseSafePreview(page, page.getByRole('button', { name: '订单 SW202608240001 更多操作' }), '订单操作预览 SW202608240001');

  await page.getByRole('button', { name: '查看订单 SW202608240001' }).click();
  const drawer = page.getByRole('dialog', { name: '订单详情 SW202608240001' });
  await expect(drawer).toBeVisible();
  await openAndCloseSafePreview(page, drawer.getByRole('button', { name: '更多', exact: true }), '更多订单操作');
  await openAndCloseSafePreview(page, drawer.getByRole('button', { name: '确认发货' }), '确认发货预览');

  expect(api.calls.filter((call) => call.method !== 'GET')).toEqual([]);
  expect(api.unmatched).toEqual([]);
});

async function openAndCloseSafePreview(page: Page, trigger: Locator, name: string): Promise<void> {
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/不会发起写操作/)).toBeVisible();
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(dialog).toBeHidden();
}

function consoleOrderApi(page: Page, orders: (call: OperationCall) => unknown): OperationMock {
  return new OperationMock(page).get('/api/v1/identity/session', previewSession).get('/api/v1/members/me', { display_name: '验收管理员', employee_no: 'E2E001' }).get('/api/v1/orders', orders);
}

function orderCalls(api: OperationMock): readonly OperationCall[] {
  return api.calls.filter((call) => call.path.startsWith('/api/v1/orders'));
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
  expect(new Set(calls.map((call) => call.path))).toEqual(new Set(['/api/v1/orders']));
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'platform:preview')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
}
