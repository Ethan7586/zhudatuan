import type { StatementImportDraft, StatementImportTask, StatementProviderOptions } from '../../../shared/import/StatementImport';

export type FinanceImportDraft = StatementImportDraft;
export type FinanceImportTask = StatementImportTask;
export type FinanceImportProviders = StatementProviderOptions;

export function emptyFinanceImportDraft(): FinanceImportDraft {
  return Object.freeze({ file: null, provider: '', partnerId: '', periodStart: '', periodEnd: '', openingMinor: '', closingMinor: '', confirmed: false });
}

export function validateFinanceImportDraft(draft: FinanceImportDraft, providers: FinanceImportProviders | undefined): string | undefined {
  if (!providers) return '正在读取当前范围的渠道目录。';
  if (providers.items.length === 0) return providers.reason ?? '当前范围没有可导入账单的渠道。';
  if (!providers.items.some(({ value }) => value === draft.provider)) return '请选择一个已启用、健康且支持账单的渠道。';
  if (!draft.file) return '请选择 CSV 或 XLSX 账单文件。';
  if (!draft.partnerId.trim() || draft.partnerId.length > 128) return '请输入有效的结算伙伴。';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.periodEnd) || draft.periodStart > draft.periodEnd) return '请选择正确的账期开始和结束日期。';
  if (![draft.openingMinor, draft.closingMinor].every((value) => /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value)))) return '期初与期末余额必须使用整数分。';
  if (!draft.confirmed) return '请确认导入只创建账单和对账任务，不会直接修改余额。';
  return undefined;
}
