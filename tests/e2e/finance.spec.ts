import { test } from '@playwright/test';
import { runConsoleJourney } from './JourneyRuntime';

test('statement import', async ({ page }) => runConsoleJourney(page, {
  scenario: 'statement import', path: '/finance/statements', assertions: ['账单导入', '总额', '行Hash', '重复', 'Watermark'],
  operations: ['finance.statements.read', 'finance.statementimports.create', 'finance.statementimports.read'],
}));

test('reconciliation repair', async ({ page }) => runConsoleJourney(page, {
  scenario: 'reconciliation repair', path: '/finance/reconciliations', assertions: ['匹配', '差异', '修复审批', '冲正', '复核'],
  operations: ['finance.reconciliations.read', 'finance.reconciliationrepairs.preview', 'finance.reconciliationrepairs.submit', 'finance.reconciliationrepairs.reverse'],
}));

test('settlement withdrawal invoice', async ({ page }) => runConsoleJourney(page, {
  scenario: 'settlement withdrawal invoice', path: '/finance/settlements', assertions: ['结算', '调整', '提现', '发票', '恢复', '账务守恒'],
  operations: ['finance.settlements.read', 'finance.settlements.adjust', 'finance.withdrawals.create', 'invoice.requests.read', 'finance.withdrawals.recover'],
}));
