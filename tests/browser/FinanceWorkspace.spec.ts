import { expect, test, type Page } from '@playwright/test';
import { expectWcagAA } from './Accessibility';
import { createConsoleMock } from './ConsoleMock';
import { consoleSession } from './Fixtures';
import type { OperationCall, OperationMock } from './OperationMock';

const financeUrl = 'http://127.0.0.1:4173/scopes/enterprise/enterprise%3Ae2e/finance';
const overview = Object.freeze({
  items: [
    {
      currency: 'CNY',
      balance_minor: 78_599_300,
      liability_minor: 13_826_400,
      income_minor: 24_863_200,
      expense_minor: 6_961_696,
      cash_minor: 31_500,
      journal_count: 18_642,
      watermark: '2026-08-24T13:26:00.000Z',
    },
  ],
});

test('Console 财务工作台只呈现严格合同内的权威对账事实', async ({ page }) => {
  const api = consoleFinanceApi(page);
  await api.install();
  await page.goto(financeUrl);

  await expect(page.getByRole('heading', { level: 1, name: '财务与对账台' })).toBeFocused();
  await expect(page.getByText('FINANCE CONTROL', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出对账单' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '发起对账' })).toBeDisabled();
  const summary = page.getByRole('region', { name: '财务状态摘要' });
  await expect(summary).toContainText('账务日服务端未提供');
  await expect(summary).toContainText('数据截止 服务端未提供');

  const table = page.getByRole('table', { name: '支付对账批次' });
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.getByText('reconciliation:wechat:1', { exact: true })).toBeVisible();
  await expect(table.getByText('wechat_pay', { exact: true })).toBeVisible();
  await expect(table.getByText('¥119.00', { exact: true })).toBeVisible();
  await expect(page.getByText('本页 1 笔', { exact: true })).toBeVisible();
  await expect(page.getByLabel('每页')).toHaveValue('50');
  await expectWcagAA(page);
  expectFinanceReadsOnly(api);
});

test('Console 财务移除合同不支持的筛选且保留无关 URL 状态', async ({ page }) => {
  const api = consoleFinanceApi(page);
  await api.install();
  await page.goto(`${financeUrl}?q=demo&channel=wechat&reconPeriod=2026-08-24&campaign=keep`);

  await expect(page.getByRole('table', { name: '支付对账批次' })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('campaign')).toBe('keep');
  await expect.poll(() => new URL(page.url()).searchParams.has('q')).toBe(false);
  const search = page.getByRole('textbox', { name: '搜索对账记录' });
  await expect(search).toBeDisabled();
  await expect(page.getByRole('combobox', { name: '支付渠道' })).toBeDisabled();
  const calls = reconciliationCalls(api);
  expect(calls.length).toBeGreaterThan(0);
  expect(
    calls.every((call) => {
      const query = new URLSearchParams(call.query);
      return query.get('limit') === '50' && !query.has('q') && !query.has('channel') && !query.has('period');
    })
  ).toBe(true);
  expectFinanceReadsOnly(api);
});

test('Console 财务选择态留在本地且差异抽屉保持只读', async ({ page }) => {
  const api = consoleFinanceApi(page);
  await api.install();
  await page.goto(`${financeUrl}?campaign=keep`);

  const row = page.getByRole('row', { name: /reconciliation:wechat:1/ });
  const checkbox = row.getByRole('checkbox', { name: '选择对账批次 reconciliation:wechat:1' });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  expect(new URL(page.url()).searchParams.has('selected')).toBe(false);

  await row.getByRole('button', { name: '查看差异' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('selected')).toBe('reconciliation:wechat:1');
  const drawer = page.getByRole('dialog', { name: '差异处理 · 复核预览' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('最终动作未接入', { exact: true })).toBeVisible();
  await expect(drawer.getByText('INTERNAL_REFERENCE_MISSING', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { name: '保存草稿' })).toBeDisabled();
  await expect(drawer.getByRole('button', { name: '提交财务复核' })).toBeDisabled();
  expect(api.calls.filter((call) => call.method !== 'GET')).toEqual([]);
  await drawer.getByRole('button', { name: '关闭复核预览' }).click();
  await expect(drawer).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.has('selected')).toBe(false);
  await expect.poll(() => new URL(page.url()).searchParams.get('campaign')).toBe('keep');
  expectFinanceReadsOnly(api);
});

test('Console 财务以服务端游标和受限页大小分页', async ({ page }) => {
  const api = consoleFinanceApi(page, financePage);
  await api.install();
  await page.goto(financeUrl);

  const table = page.getByRole('table', { name: '支付对账批次' });
  await expect(table.locator('tbody tr')).toHaveCount(50);
  expect(lastReconciliationQuery(api).get('limit')).toBe('50');

  await page.getByRole('button', { name: '下一页' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('cursor')).toBe('finance:50');
  await expect(table.locator('tbody tr')).toHaveCount(5);
  await expect(table.getByText('reconciliation:pagination:0051', { exact: true })).toBeVisible();

  await page.getByLabel('每页').selectOption('20');
  await expect.poll(() => new URL(page.url()).searchParams.get('limit')).toBe('20');
  await expect.poll(() => new URL(page.url()).searchParams.has('cursor')).toBe(false);
  await expect(table.locator('tbody tr')).toHaveCount(20);
  expect(lastReconciliationQuery(api).get('limit')).toBe('20');
  expectFinanceReadsOnly(api);
});

function consoleFinanceApi(page: Page, reconciliations: (call: OperationCall) => unknown = () => ({ items: [reconciliation(1)], count: 1 })): OperationMock {
  return createConsoleMock(page, consoleSession).get('/api/v1/finance/overview', overview).get('/api/v1/finance/reconciliations', reconciliations);
}

function reconciliation(serial: number) {
  const suffix = String(serial).padStart(4, '0');
  return Object.freeze({
    id: serial === 1 ? 'reconciliation:wechat:1' : `reconciliation:pagination:${suffix}`,
    scope_id: 'enterprise:e2e',
    provider: 'wechat_pay',
    partner_id: 'mall:e2e',
    period: '2026-08-24',
    statement_ref: `statement:${suffix}`,
    statement_hash: 'a'.repeat(64),
    state: 'difference',
    debit_minor: 31_500,
    credit_minor: 19_600,
    difference_minor: 11_900,
    created_by: 'membership:maker',
    approved_by: null,
    evidence: {},
    updated_at: '2026-08-24T13:26:00.000Z',
    version: 7,
    item_counts: { matched: 2, difference: 1 },
    items: [
      {
        id: `reconciliationdifference:${suffix}`,
        externalMinor: 11_900,
        internalMinor: 0,
        differenceMinor: 11_900,
        state: 'difference',
        reasonCode: 'INTERNAL_REFERENCE_MISSING',
        evidence: {},
        resolution: null,
        resolvedBy: null,
        approvedBy: null,
      },
    ],
  });
}

const reconciliationRows = Object.freeze(Array.from({ length: 55 }, (_, index) => reconciliation(index + 1)));

function financePage(call: OperationCall) {
  const query = new URLSearchParams(call.query);
  const limit = Number(query.get('limit'));
  expect([20, 50]).toContain(limit);
  const cursor = query.get('cursor');
  const offset = cursor === null ? 0 : Number(cursor.replace('finance:', ''));
  expect(Number.isSafeInteger(offset)).toBe(true);
  const items = reconciliationRows.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return Object.freeze({ items, count: items.length, ...(nextOffset < reconciliationRows.length ? { nextCursor: `finance:${nextOffset}` } : {}) });
}

function reconciliationCalls(api: OperationMock): readonly OperationCall[] {
  return api.calls.filter((call) => call.path === '/api/v1/finance/reconciliations');
}

function lastReconciliationQuery(api: OperationMock): URLSearchParams {
  const call = reconciliationCalls(api).at(-1);
  expect(call).toBeDefined();
  return new URLSearchParams(call?.query);
}

function expectFinanceReadsOnly(api: OperationMock): void {
  const calls = api.calls.filter((call) => call.path.startsWith('/api/v1/finance/'));
  expect(calls.length).toBeGreaterThan(0);
  expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'enterprise:e2e')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
  expect(api.unmatched).toEqual([]);
}
