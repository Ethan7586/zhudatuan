<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { consoleSession } from './Fixtures';
import {
  financeAuditPreviewPage,
  financePolicyPreviewPage,
  financePreviewEntriesPage,
  financePreviewOverview,
  financePreviewReconciliations,
  financePreviewSettlementsPage,
  financeReconciliationPreviewPage,
  type FinanceReconciliationPreviewPage,
  type FinanceReconciliationRecord,
} from './FinancePreviewFixtures';
=======
=======
import AxeBuilder from '@axe-core/playwright';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { expect, test, type Page } from '@playwright/test';
import { consoleSession } from './Fixtures';
<<<<<<< HEAD
import { financePreviewOverview, financePreviewReconciliations, financeReconciliationPreviewPage, type FinanceReconciliationPreviewPage, type FinanceReconciliationRecord } from './FinancePreviewFixtures';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import {
  financeAuditPreviewPage,
  financePolicyPreviewPage,
  financePreviewEntriesPage,
  financePreviewOverview,
  financePreviewReconciliations,
  financePreviewSettlementsPage,
  financeReconciliationPreviewPage,
  type FinanceReconciliationPreviewPage,
  type FinanceReconciliationRecord,
} from './FinancePreviewFixtures';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { OperationMock, type OperationCall } from './OperationMock';
import { CONSOLE_ORIGIN } from './Origins';
=======
import { expect, test, type Page } from '@playwright/test';
import { expectWcagAA } from './Accessibility';
import { consoleSession } from './Fixtures';
import { financePreviewOverview, financePreviewReconciliations, financeReconciliationPreviewPage, type FinanceReconciliationPreviewPage, type FinanceReconciliationRecord } from './FinancePreviewFixtures';
import { OperationMock, type OperationCall } from './OperationMock';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

const previewScope = Object.freeze({ kind: 'platform', id: 'platform:preview', name: '本地预览平台' });
const previewSession = Object.freeze({
  ...consoleSession,
  scope: previewScope,
  scopes: Object.freeze([previewScope]),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  permissions: Object.freeze([...consoleSession.permissions, 'finance.overview.read', 'finance.reconciliation.read', 'finance.reconciliations.read', 'finance.entries.read', 'finance.settlements.read', 'finance.policy.read', 'audit.read']),
  capabilities: Object.freeze([...consoleSession.capabilities, 'finance.overview.read', 'finance.reconciliations.read', 'finance.entries.read', 'finance.settlements.read', 'finance.policies.read', 'finance.audit.read']),
  assurance: Object.freeze({ level: 3, verified: 'step-up' }),
});
const financeUrl = '/scopes/platform/platform%3Apreview/finance';
=======
  permissions: Object.freeze([...consoleSession.permissions, 'finance.overview.read', 'finance.reconciliations.read']),
  capabilities: Object.freeze([...consoleSession.capabilities, 'finance.overview.read', 'finance.reconciliations.read']),
=======
  permissions: Object.freeze([...consoleSession.permissions, 'finance.overview.read', 'finance.reconciliations.read', 'finance.entries.read', 'finance.settlements.read', 'finance.policy.read', 'audit.read']),
=======
  permissions: Object.freeze([...consoleSession.permissions, 'finance.overview.read', 'finance.reconciliation.read', 'finance.reconciliations.read', 'finance.entries.read', 'finance.settlements.read', 'finance.policy.read', 'audit.read']),
>>>>>>> 05ea98a5 (fix(release): restore selected app verification)
  capabilities: Object.freeze([...consoleSession.capabilities, 'finance.overview.read', 'finance.reconciliations.read', 'finance.entries.read', 'finance.settlements.read', 'finance.policies.read', 'finance.audit.read']),
>>>>>>> 018b2a71 (chore(release): capture current production source)
  assurance: Object.freeze({ level: 3, verified: 'step-up' }),
});
<<<<<<< HEAD
const financeConsoleOrigin = process.env.FINANCE_CONSOLE_ORIGIN ?? 'http://127.0.0.1:4183';
const financeUrl = `${financeConsoleOrigin}/scopes/platform/platform%3Apreview/finance`;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
const financeUrl = `${process.env.FINANCE_CONSOLE_ORIGIN ?? CONSOLE_ORIGIN}/scopes/platform/platform%3Apreview/finance`;
>>>>>>> 05ea98a5 (fix(release): restore selected app verification)
=======
  permissions: Object.freeze([...consoleSession.permissions, 'finance.overview.read', 'finance.reconciliations.read']),
  capabilities: Object.freeze([...consoleSession.capabilities, 'finance.overview.read', 'finance.reconciliations.read']),
  assurance: Object.freeze({ level: 3, verified: 'step-up' }),
});
const financeConsoleOrigin = process.env.FINANCE_CONSOLE_ORIGIN ?? 'http://127.0.0.1:4173';
const financeUrl = `${financeConsoleOrigin}/scopes/platform/platform%3Apreview/finance`;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
const differenceReconciliation = financePreviewReconciliations[0]!;

test('Console 财务工作台呈现参考页头、状态、页签与服务端对账表', async ({ page }) => {
  const api = consoleFinanceApi(page);
  await api.install();
  await page.goto(financeUrl);

  await expect(page.getByRole('heading', { level: 1, name: '财务与对账系统' })).toBeVisible();
  await expect(page.getByText('FINANCE CONTROL', { exact: true })).toBeVisible();
  await expect(page.getByText('核对支付、退款、渠道账单与账本记录，确保每笔账款可追溯、可复核', { exact: true })).toBeVisible();
<<<<<<< HEAD
<<<<<<< HEAD
  await expect(page.getByRole('button', { name: '导出当前页' })).toBeEnabled();
=======
  await expect(page.getByRole('button', { name: '导出对账单' })).toBeEnabled();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  await expect(page.getByRole('button', { name: '导出对账单' })).toBeEnabled();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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

<<<<<<< HEAD
<<<<<<< HEAD
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出当前页' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^finance-payments-current-page-.*\.csv$/);
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  await page.getByRole('button', { name: '导出对账单' }).click();
  const exportPreview = page.getByRole('dialog', { name: '导出对账单 · 安全预览' });
  await expect(exportPreview.getByText('当前不会生成或下载正式账单', { exact: true })).toBeVisible();
  await exportPreview.getByRole('button', { name: '我知道了' }).click();
  await expect(exportPreview).toBeHidden();
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

  await page.getByRole('button', { name: '发起对账' }).click();
  const startPreview = page.getByRole('dialog', { name: '发起对账 · 安全预览' });
  await expect(startPreview.getByText('当前不会创建对账批次', { exact: true })).toBeVisible();
  await startPreview.getByRole('button', { name: '我知道了' }).click();
  await expect(startPreview).toBeHidden();

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  await expectFinanceWcagAA(page);
=======
  await expectWcagAA(page);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  await expectFinanceWcagAA(page);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  await expectWcagAA(page);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  const balancedRow = table.getByRole('row', { name: /RCN-20260824-ALIPAY-001/ });
  await expect(balancedRow.getByRole('button', { name: '无差异' })).toBeDisabled();
  await balancedRow.getByText('RCN-20260824-ALIPAY-001', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: '差异处理 · 复核预览' })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('selected')).toBe(false);

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  await expect(drawer.getByText('本地安全预览', { exact: true })).toBeVisible();
=======
  await expect(drawer.getByText('服务端预览', { exact: true })).toBeVisible();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  await expect(drawer.getByText('本地安全预览', { exact: true })).toBeVisible();
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  await expect(drawer.getByText('服务端预览', { exact: true })).toBeVisible();
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  await expectFinanceWcagAA(page);
=======
  await expectWcagAA(page);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  await expectFinanceWcagAA(page);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  await expectWcagAA(page);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

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

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
test('Console 退款、规则与审计页签读取各自权威合同且全程只读', async ({ page }) => {
=======
test('Console 财务无权威读合同的页签诚实显示不可用', async ({ page }) => {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
test('Console 退款、规则与审计页签读取各自权威合同且全程只读', async ({ page }) => {
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
test('Console 财务无权威读合同的页签诚实显示不可用', async ({ page }) => {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  const api = consoleFinanceApi(page);
  await api.install();
  await page.goto(financeUrl);
  await expect(page.getByRole('table', { name: '支付对账批次' })).toBeVisible();

  const tabs = page.getByRole('navigation', { name: '财务工作台' });
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  await tabs.getByRole('button', { name: '退款对账' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('refunds');
  const refundTable = page.getByRole('table', { name: '退款对账批次' });
  await expect(refundTable).toBeVisible();
  await expect(refundTable.locator('tbody tr')).toHaveCount(1);
  await expect(refundTable.getByText('RCN-20260824-WECHAT-REFUND-001', { exact: true })).toBeVisible();
  expect(lastFinanceQuery(api).get('kind')).toBe('refund');

  await page.goto(`${financeUrl}?tab=rules&limit=20&cursor=start`);
  await expect(tabs.getByRole('button', { name: '对账规则' })).toHaveAttribute('aria-current', 'page');
  const policies = page.getByRole('table', { name: '对账规则' });
  await expect(policies).toBeVisible();
  await expect(policies.locator('tbody tr')).toHaveCount(3);
  await expect(policies.getByText('finance.policy.reconciliation.wechat.payment', { exact: true })).toBeVisible();
  await expect(policies.getByText(/"matchMode":"one-to-one"/)).toBeVisible();
  await expect(policies.getByText('v3', { exact: true })).toBeVisible();
  await expect(policies.getByRole('button', { name: /编辑规则 .*（未启用）/ })).toHaveCount(3);
  for (const button of await policies.getByRole('button', { name: /编辑规则 .*（未启用）/ }).all()) await expect(button).toBeDisabled();
  await expect(page.getByText(/LOCAL PREVIEW FIXTURE/)).toBeVisible();
  expect(new URL(page.url()).searchParams.get('limit')).toBe('20');
  expect(new URL(page.url()).searchParams.get('cursor')).toBe('start');
  const policyCall = financeCalls(api)
    .filter((call) => call.path === '/api/v1/finance/policies')
    .at(-1);
  expect(policyCall).toBeDefined();
  expect(new URLSearchParams(policyCall?.query).get('limit')).toBe('20');
  expect(new URLSearchParams(policyCall?.query).get('cursor')).toBe('start');

  const ruleKinds = page.getByRole('navigation', { name: '财务规则类型' });
  await ruleKinds.getByRole('button', { name: '税务规则' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('ruleKind')).toBe('tax');
  const taxRules = page.getByRole('table', { name: '税务规则' });
  await expect(taxRules.locator('tbody tr')).toHaveCount(3);
  await expect(taxRules.getByText('中国标准商品增值税', { exact: true })).toBeVisible();
  await expect(taxRules.getByText('13%', { exact: true })).toBeVisible();
  await taxRules.getByRole('button', { name: '编辑' }).first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('edit');
  const editor = page.getByRole('dialog', { name: '财务规则配置' });
  await editor.getByLabel('规则名称').fill('中国标准商品增值税（本地新版本）');
  await editor.getByRole('button', { name: '保存本地草稿' }).click();
  await expect(editor.getByText(/中国标准商品增值税（本地新版本）/)).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('view');
  await editor.getByRole('button', { name: '关闭财务规则配置' }).click();

  await ruleKinds.getByRole('button', { name: '字段定义' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('ruleKind')).toBe('fields');
  const fields = page.getByRole('table', { name: '字段定义' });
  await expect(fields.locator('tbody tr')).toHaveCount(7);
  await expect(fields.getByText('免税原因', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新增字段定义' }).click();
  const fieldEditor = page.getByRole('dialog', { name: '财务规则配置' });
  await fieldEditor.getByLabel('字段代码').fill('payable.approval_note');
  await fieldEditor.getByLabel('显示名称').fill('应付审批备注');
  await fieldEditor.getByLabel('适用对象').selectOption('accounts_payable');
  await fieldEditor.getByLabel('数据类型').selectOption('text');
  await fieldEditor.getByRole('button', { name: '保存本地草稿' }).click();
  await expect(fieldEditor.getByText(/payable.approval_note/)).toBeVisible();
  await fieldEditor.getByRole('button', { name: '关闭财务规则配置' }).click();
  await expect(fields.locator('tbody tr')).toHaveCount(8);
  const newField = fields.getByRole('row', { name: /应付审批备注/ });
  await newField.getByRole('button', { name: '编辑' }).click();
  await fieldEditor.getByLabel('显示名称').fill('应付审批说明');
  await fieldEditor.getByRole('button', { name: '保存本地草稿' }).click();
  await expect(fieldEditor.getByText(/应付审批说明/)).toBeVisible();
  await fieldEditor.getByRole('button', { name: '关闭财务规则配置' }).click();

  await tabs.getByRole('button', { name: '审计记录' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('audit');
  await expect(tabs.getByRole('button', { name: '审计记录' })).toHaveAttribute('aria-current', 'page');
  const audits = page.getByRole('table', { name: '审计记录' });
  await expect(audits).toBeVisible();
  await expect(audits.locator('tbody tr')).toHaveCount(3);
  await expect(audits.getByText('finance.reconciliations.approve', { exact: true })).toBeVisible();
  await expect(audits.getByText(/member · actor:finance:reviewer/)).toBeVisible();
  await expect(audits.getByText('4'.repeat(64), { exact: true })).toBeVisible();
  await expect(audits.getByText(/"fourEyes":true/)).toBeVisible();
  await expect(audits.getByRole('button', { name: /审计记录 .* 不可变/ })).toHaveCount(3);
  for (const button of await audits.getByRole('button', { name: /审计记录 .* 不可变/ }).all()) await expect(button).toBeDisabled();
  await expectFinanceWcagAA(page);
<<<<<<< HEAD
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

  await tabs.getByRole('button', { name: '支付对账' }).click();
  await expect(page.getByRole('table', { name: '支付对账批次' })).toBeVisible();
  expectFinanceReadsOnly(api);
});

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
test('Console 财务结算与分录页签读取 authoritative-shaped preview 合同', async ({ page }) => {
  const api = consoleFinanceApi(page);
  await api.install();
  await page.goto(financeUrl);
  const tabs = page.getByRole('navigation', { name: '财务工作台' });
  await expect(page.getByRole('table', { name: '支付对账批次' })).toBeVisible();

  await tabs.getByRole('button', { name: '结算单' }).click();
  await expect(page).toHaveURL(/\/finance\/settlements$/);
  await expect(tabs.getByRole('button', { name: '结算单' })).toHaveAttribute('aria-current', 'page');
  const settlements = page.getByRole('table', { name: '结算' });
  await expect(settlements).toBeVisible();
  await expect(settlements.locator('tbody tr')).toHaveCount(1);
  await expect(settlements.getByText('partner:mall:huimin · 2026-08-24', { exact: true })).toBeVisible();
  await expect(settlements.getByText('¥426.00', { exact: true })).toBeVisible();

  await tabs.getByRole('button', { name: '账本分录' }).click();
  await expect(page).toHaveURL(/\/finance\/entries$/);
  await expect(tabs.getByRole('button', { name: '账本分录' })).toHaveAttribute('aria-current', 'page');
  const entries = page.getByRole('table', { name: '财务分录' });
  await expect(entries).toBeVisible();
  await expect(entries.locator('tbody tr')).toHaveCount(2);
  await expect(entries.getByText('cash.wechat', { exact: true })).toBeVisible();
  await expect(entries.getByText('payment:PAY-20260824-0119', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/资金写操作保持关闭/)).toBeVisible();
  await expect(page.getByText(/CONTRACT_RESPONSE_INVALID/)).toHaveCount(0);

  expect(financeCalls(api).filter((call) => call.path === '/api/v1/finance/settlements').length).toBeGreaterThan(0);
  expect(financeCalls(api).filter((call) => call.path === '/api/v1/finance/entries').length).toBeGreaterThan(0);
  expectFinanceReadsOnly(api);
});

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    .get('/api/v1/finance/reconciliations', reconciliations)
    .get('/api/v1/finance/entries', financePreviewEntriesPage)
    .get('/api/v1/finance/settlements', financePreviewSettlementsPage)
    .get('/api/v1/finance/policies', (call) => financePolicyPreviewPage(new URLSearchParams(call.query)))
    .get('/api/v1/finance/audits', (call) => financeAuditPreviewPage(new URLSearchParams(call.query)));
<<<<<<< HEAD
=======
    .get('/api/v1/finance/reconciliations', reconciliations);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    .get('/api/v1/finance/reconciliations', reconciliations);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
  expect(calls.every((call) => ['/api/v1/finance/overview', '/api/v1/finance/reconciliations', '/api/v1/finance/entries', '/api/v1/finance/settlements', '/api/v1/finance/policies', '/api/v1/finance/audits'].includes(call.path))).toBe(true);
=======
  expect(reconciliationCalls(api).length).toBeGreaterThan(0);
  expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
  expect(calls.every((call) => ['/api/v1/finance/overview', '/api/v1/finance/reconciliations'].includes(call.path))).toBe(true);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
  expect(calls.every((call) => ['/api/v1/finance/overview', '/api/v1/finance/reconciliations', '/api/v1/finance/entries', '/api/v1/finance/settlements', '/api/v1/finance/policies', '/api/v1/finance/audits'].includes(call.path))).toBe(true);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  expect(reconciliationCalls(api).length).toBeGreaterThan(0);
  expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
  expect(calls.every((call) => ['/api/v1/finance/overview', '/api/v1/finance/reconciliations'].includes(call.path))).toBe(true);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  expect(calls.every((call) => call.headers['x-scope-hint'] === 'platform:preview')).toBe(true);
  expect(calls.every((call) => call.headers['x-access-version'] === '1')).toBe(true);
  expectNoWrites(api);
  expect(api.unmatched).toEqual([]);
}

function expectNoWrites(api: OperationMock): void {
  expect(api.calls.filter((call) => call.method !== 'GET')).toEqual([]);
}

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
async function expectFinanceWcagAA(page: Page): Promise<void> {
  const builder = new AxeBuilder({ page }).include('.financeworkspace').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  if (await page.locator('.financedrawer').isVisible()) builder.include('.financedrawer');
  const result = await builder.analyze();
  expect(result.violations, describeViolations(result.violations)).toEqual([]);
}

function describeViolations(
  violations: readonly {
    id: string;
    impact?: string | null;
    nodes: readonly { target: readonly string[] }[];
  }[]
): string {
  return violations.map((violation) => `${violation.impact ?? 'unknown'} ${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`).join('\n');
}

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
