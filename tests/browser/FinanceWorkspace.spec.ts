import { expect, test, type Page } from '@playwright/test';
import { expectWcagAA } from './Accessibility';
import { consoleSession } from './Fixtures';
import { financePreviewOverview, financePreviewReconciliations, financeReconciliationPreviewPage, type FinanceReconciliationPreviewPage, type FinanceReconciliationRecord } from './FinancePreviewFixtures';
import { OperationMock, type OperationCall } from './OperationMock';
import { CONSOLE_ORIGIN } from './Origins';

const previewScope = Object.freeze({ kind: 'platform', id: 'platform:preview', name: '本地预览平台' });
const previewSession = Object.freeze({
  ...consoleSession,
  scope: previewScope,
  scopes: Object.freeze([previewScope]),
  permissions: Object.freeze([...consoleSession.permissions, 'finance.overview.read', 'finance.reconciliation.read']),
  capabilities: Object.freeze([...consoleSession.capabilities, 'finance.overview.read', 'finance.reconciliations.read']),
  assurance: Object.freeze({ level: 3, verified: 'step-up' }),
});
const financeUrl = `${CONSOLE_ORIGIN}/scopes/platform/platform%3Apreview/finance`;
const differenceReconciliation = financePreviewReconciliations[0]!;

test('Console 财务工作台呈现参考页头、状态、页签与服务端对账表', async ({ page }) => {
  const api = consoleFinanceApi(page);
  await api.install();
  await page.goto(financeUrl);

  await expect(page.getByRole('heading', { level: 1, name: '财务与对账系统' })).toBeVisible();
  await expect(page.getByText('FINANCE CONTROL', { exact: true })).toBeVisible();
  await expect(page.getByText('核对支付、退款、渠道账单与账本记录，确保每笔账款可追溯、可复核', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出对账单' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '发起对账' })).toBeEnabled();

  const summary = page.getByRole('region', { name: '财务状态摘要' });
  await expect(summary.getByText('账务日', { exact: true })).toBeVisible();
  await expect(summary.getByText('2026-08-24', { exact: true })).toBeVisible();
  await expect(summary.getByText('最近对账', { exact: true })).toBeVisible();
  await expect(summary.getByText('差异待处理', { exact: true })).toBeVisible();
  await expect(summary.getByText('1 项', { exact: true })).toBeVisible();
  await expect(summary.getByText('等待复核', { exact: true })).toBeVisible();
  await expect(summary.getByText('0 项', { exact: true })).toBeVisible();
  await expect(summary.getByText(/数据截止/)).toBeVisible();

  const tabs = page.getByRole('navigation', { name: '财务工作台' });
  await expect(tabs.getByRole('button')).toHaveText(['支付对账', '退款对账', '结算单', '账本分录', '对账规则', '审计记录']);
  await expect(tabs.getByRole('button', { name: '支付对账' })).toHaveAttribute('aria-current', 'page');

  const table = page.getByRole('table', { name: '支付对账批次' });
  await expect(table.getByRole('columnheader')).toHaveText(['', '对账批次 / 账期', '渠道 / 数据源', '所属范围', '应对账', '已匹配', '差异', '渠道金额', '账本金额', '差额', '状态', '完成 / 更新时间', '操作']);
  await expect(table.locator('tbody tr')).toHaveCount(7);
  await expect(table.getByText('RCN-20260824-WECHAT-001', { exact: true })).toBeVisible();
  await expect(table.getByText('微信支付', { exact: true })).toBeVisible();
  await expect(table.getByText('有差异', { exact: true })).toBeVisible();
  await expect(page.getByText('1–7 / 共 7 笔', { exact: true })).toBeVisible();
  await expect(page.getByLabel('每页')).toHaveValue('50');

  const search = page.getByLabel('搜索对账记录');
  await search.focus();
  await expect(search).toBeFocused();
  expect(await search.locator('..').evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe('none');

  await page.getByRole('button', { name: '导出对账单' }).click();
  const exportPreview = page.getByRole('dialog', { name: '导出对账单 · 安全预览' });
  await expect(exportPreview.getByText('当前不会生成或下载正式账单', { exact: true })).toBeVisible();
  await exportPreview.getByRole('button', { name: '我知道了' }).click();
  await expect(exportPreview).toBeHidden();

  await page.getByRole('button', { name: '发起对账' }).click();
  const startPreview = page.getByRole('dialog', { name: '发起对账 · 安全预览' });
  await expect(startPreview.getByText('当前不会创建对账批次', { exact: true })).toBeVisible();
  await startPreview.getByRole('button', { name: '我知道了' }).click();
  await expect(startPreview).toBeHidden();

  await expectWcagAA(page);
  expectFinanceReadsOnly(api);
});

test('Console 财务筛选写入 URL 并原样交给预览服务端', async ({ page }) => {
  const api = consoleFinanceApi(page);
  await api.install();
  await page.goto(financeUrl);
  const table = page.getByRole('table', { name: '支付对账批次' });
  await expect(table.locator('tbody tr')).toHaveCount(7);

  await page.getByLabel('搜索对账记录').fill('PAY-20260824-0119');
  await page.getByLabel('搜索对账记录').press('Enter');
  await page.getByRole('combobox', { name: '账期' }).selectOption('2026-08-24');
  await page.getByRole('combobox', { name: '支付渠道' }).selectOption('wechat');
  await page.getByRole('combobox', { name: '商城范围' }).selectOption('mall:huimin');
  await page.getByRole('combobox', { name: '对账状态' }).selectOption('difference');
  await page.getByRole('combobox', { name: '差异类型' }).selectOption('missing_journal_event');

  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.getByText('RCN-20260824-WECHAT-001', { exact: true })).toBeVisible();
  await expect.poll(() => lastFinanceQuery(api).get('difference')).toBe('missing_journal_event');

  const browserQuery = new URL(page.url()).searchParams;
  expect(Object.fromEntries(browserQuery.entries())).toMatchObject({
    q: 'PAY-20260824-0119',
    reconPeriod: '2026-08-24',
    channel: 'wechat',
    mall: 'mall:huimin',
    status: 'difference',
    difference: 'missing_journal_event',
  });
  const serverQuery = lastFinanceQuery(api);
  expect(Object.fromEntries(serverQuery.entries())).toMatchObject({
    q: 'PAY-20260824-0119',
    period: '2026-08-24',
    channel: 'wechat',
    mall: 'mall:huimin',
    status: 'difference',
    difference: 'missing_journal_event',
    limit: '50',
  });
  expect(serverQuery.has('reconPeriod')).toBe(false);

  await page.getByRole('button', { name: '重置' }).click();
  await expect(table.locator('tbody tr')).toHaveCount(7);
  await expect.poll(() => new URL(page.url()).searchParams.has('q')).toBe(false);
  expectFinanceReadsOnly(api);
});

test('Console 财务复选不打开抽屉，selected URL 可恢复安全复核预览', async ({ page }) => {
  const api = consoleFinanceApi(page);
  await api.install();
  await page.goto(financeUrl);

  const table = page.getByRole('table', { name: '支付对账批次' });
  const differenceRow = table.getByRole('row', { name: /RCN-20260824-WECHAT-001/ });
  const checkbox = differenceRow.getByRole('checkbox', { name: '选择对账批次 RCN-20260824-WECHAT-001' });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await expect(page.getByRole('dialog', { name: '差异处理 · 复核预览' })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('selected')).toBe(false);

  const viewDifference = differenceRow.getByRole('button', { name: '查看差异' });
  await viewDifference.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('selected')).toBe(differenceReconciliation.id);
  const drawer = page.getByRole('dialog', { name: '差异处理 · 复核预览' });
  await expect(drawer).toBeVisible();
  await expect.poll(() => drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await expect(drawer.getByRole('heading', { name: '差异处理 · 复核预览' })).toBeVisible();
  await expect(drawer.getByText('DIFF-20260824-0001', { exact: true })).toBeVisible();
  await expect(drawer.getByText('服务端预览', { exact: true })).toBeVisible();
  await expect(drawer.getByText('待提交复核', { exact: true })).toBeVisible();
  await expect(drawer.getByText(/版本 v7 · 预览有效至/)).toBeVisible();
  await expect(drawer.getByText('本方案将重放缺失记账事件；不修改或删除原支付、渠道账单及历史账本。', { exact: true })).toBeVisible();

  for (const title of ['修复方案（服务端生成）', '拟生成分录', '预计处理结果', '提交前校验', '处理依据']) {
    await expect(drawer.getByRole('heading', { name: title })).toBeVisible();
  }
  await expect(drawer.getByText('借贷平衡由服务端快照验证', { exact: true })).toBeVisible();
  await expect(drawer.getByText('财务处理权限与 Level 3 二次验证有效', { exact: true })).toBeVisible();
  await expect(drawer.getByText('未发现相同 reference / 幂等键的账本分录', { exact: true })).toBeVisible();
  await expect(drawer.getByText('账期开放，sourceHash 与当前证据一致', { exact: true })).toBeVisible();
  await expect(drawer.getByText('itemVersion 与预览版本一致', { exact: true })).toBeVisible();
  await expect(drawer.getByText('previewHash', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Idempotency-Key', { exact: true })).toBeVisible();
  await expect(drawer.getByText(/发起人不能审批自己的处理方案/)).toBeVisible();

  await drawer.getByRole('button', { name: '保存草稿' }).click();
  await expect(drawer.getByRole('status')).toHaveText('本地安全预览：草稿未写入，服务端尚无 draft Operation。');
  await drawer.getByRole('button', { name: '提交财务复核' }).click();
  await expect(drawer.getByRole('status')).toHaveText('提交已安全拦截：尚未闭合二次验证、proof、幂等与权威回读。');
  expectNoWrites(api);
  await expectWcagAA(page);

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.has('selected')).toBe(false);
  await expect(viewDifference).toBeFocused();

  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get('selected')).toBe(differenceReconciliation.id);
  await expect(drawer).toBeVisible();
  await page.reload();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('DIFF-20260824-0001', { exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: '关闭复核预览' }).click();
  await expect(drawer).toBeHidden();

  expectFinanceReadsOnly(api);
});

test('Console 财务无权威读合同的页签诚实显示不可用', async ({ page }) => {
  const api = consoleFinanceApi(page);
  await api.install();
  await page.goto(financeUrl);
  await expect(page.getByRole('table', { name: '支付对账批次' })).toBeVisible();

  const tabs = page.getByRole('navigation', { name: '财务工作台' });
  const unavailableTabs = [
    ['退款对账', 'refunds', '现有 reconciliation read 没有退款类型筛选或退款专用权威读模型。'],
    ['对账规则', 'rules', '当前只有高风险策略写 Operation，没有可验证的规则读取合同。'],
    ['审计记录', 'audit', '当前没有财务审计记录的独立 read Operation。'],
  ] as const;
  for (const [label, key, detail] of unavailableTabs) {
    await tabs.getByRole('button', { name: label }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe(key);
    await expect(tabs.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page');
    const unavailable = page.locator('.financeunavailabletab');
    await expect(unavailable).toHaveAttribute('role', 'status');
    await expect(unavailable.getByText('CAPABILITY UNAVAILABLE', { exact: true })).toBeVisible();
    await expect(unavailable.getByRole('heading', { name: label })).toBeVisible();
    await expect(unavailable.getByText(detail, { exact: false })).toBeVisible();
    await expect(unavailable.getByText(/不会用演示数据替代生产事实/)).toBeVisible();
    await expect(page.getByRole('table', { name: '支付对账批次' })).toHaveCount(0);
  }

  await tabs.getByRole('button', { name: '支付对账' }).click();
  await expect(page.getByRole('table', { name: '支付对账批次' })).toBeVisible();
  expectFinanceReadsOnly(api);
});

test('Console 财务游标分页保持默认 50 条边界并由 limit URL 驱动', async ({ page }) => {
  const api = consoleFinanceApi(page, financePaginationPage);
  await api.install();
  await page.goto(financeUrl);

  const table = page.getByRole('table', { name: '支付对账批次' });
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('1–50 / 共 55 笔', { exact: true })).toBeVisible();
  expect(lastFinanceQuery(api).get('limit')).toBe('50');

  await page.getByRole('button', { name: '下一页' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('cursor')).toBe('finance:50');
  await expect(table.locator('tbody tr')).toHaveCount(5);
  await expect(table.getByText('RCN-PREVIEW-0051', { exact: true })).toBeVisible();
  await expect(page.getByText('51–55 / 共 55 笔', { exact: true })).toBeVisible();

  await page.getByLabel('每页').selectOption('20');
  await expect.poll(() => new URL(page.url()).searchParams.get('limit')).toBe('20');
  expect(new URL(page.url()).searchParams.has('cursor')).toBe(false);
  await expect(table.locator('tbody tr')).toHaveCount(20);
  await expect(page.getByText('1–20 / 共 55 笔', { exact: true })).toBeVisible();
  expect(lastFinanceQuery(api).get('limit')).toBe('20');

  await page.getByRole('button', { name: '下一页' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('cursor')).toBe('finance:20');
  await expect(table.locator('tbody tr')).toHaveCount(20);
  await expect(page.getByText('21–40 / 共 55 笔', { exact: true })).toBeVisible();
  expectFinanceReadsOnly(api);
});

function consoleFinanceApi(page: Page, reconciliations: (call: OperationCall) => unknown = (call) => financeReconciliationPreviewPage(new URLSearchParams(call.query))): OperationMock {
  return new OperationMock(page)
    .get('/api/v1/identity/session', previewSession)
    .get('/api/v1/members/me', { display_name: '验收管理员', employee_no: 'E2E001' })
    .get('/api/v1/finance/overview', financePreviewOverview)
    .get('/api/v1/finance/reconciliations', reconciliations);
}

function financeCalls(api: OperationMock): readonly OperationCall[] {
  return api.calls.filter((call) => call.path.startsWith('/api/v1/finance/'));
}

function reconciliationCalls(api: OperationMock): readonly OperationCall[] {
  return api.calls.filter((call) => call.path === '/api/v1/finance/reconciliations');
}

function lastFinanceQuery(api: OperationMock): URLSearchParams {
  const call = reconciliationCalls(api).at(-1);
  expect(call).toBeDefined();
  return new URLSearchParams(call?.query);
}

function expectFinanceReadsOnly(api: OperationMock): void {
  const calls = financeCalls(api);
  expect(calls.length).toBeGreaterThan(0);
  expect(reconciliationCalls(api).length).toBeGreaterThan(0);
  expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
  expect(calls.every((call) => ['/api/v1/finance/overview', '/api/v1/finance/reconciliations'].includes(call.path))).toBe(true);
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'platform:preview')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
  expectNoWrites(api);
  expect(api.unmatched).toEqual([]);
}

function expectNoWrites(api: OperationMock): void {
  expect(api.calls.filter((call) => call.method !== 'GET')).toEqual([]);
}

const financePaginationRows: readonly FinanceReconciliationRecord[] = Object.freeze(
  Array.from({ length: 55 }, (_, index) => {
    const source = financePreviewReconciliations[index % financePreviewReconciliations.length]!;
    const serial = String(index + 1).padStart(4, '0');
    return Object.freeze({
      ...source,
      id: `reconciliation:preview:pagination:${serial}`,
      preview: Object.freeze({ ...source.preview, batchId: `RCN-PREVIEW-${serial}` }),
      items: Object.freeze(
        source.items.map((item, itemIndex) =>
          Object.freeze({
            ...item,
            id: `reconciliationitem:preview:pagination:${serial}:${itemIndex + 1}`,
          })
        )
      ),
    });
  })
);

function financePaginationPage(call: OperationCall): FinanceReconciliationPreviewPage {
  const query = new URLSearchParams(call.query);
  const limit = Number(query.get('limit'));
  expect([20, 50]).toContain(limit);
  const cursor = query.get('cursor');
  const offset = cursor === null || cursor === 'start' ? 0 : Number(cursor.replace('finance:', ''));
  expect(Number.isSafeInteger(offset)).toBe(true);
  expect(offset).toBeGreaterThanOrEqual(0);
  const items = Object.freeze(financePaginationRows.slice(offset, offset + limit));
  const nextOffset = offset + items.length;
  const base = financeReconciliationPreviewPage(new URLSearchParams('limit=50'));
  return Object.freeze({
    items,
    count: items.length,
    ...(nextOffset < financePaginationRows.length ? { nextCursor: `finance:${nextOffset}` } : {}),
    preview: Object.freeze({
      ...base.preview,
      total: financePaginationRows.length,
      page: Math.floor(offset / limit) + 1,
      ...(offset === 0 ? {} : { previousCursor: offset <= limit ? 'start' : `finance:${Math.max(0, offset - limit)}` }),
    }),
  });
}
