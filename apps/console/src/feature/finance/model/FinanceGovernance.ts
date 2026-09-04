import type { FinanceRepairDecision, OperationOutputFor } from '@shop/contract';

export type FinancePolicy = OperationOutputFor<'finance.policies.read'>['items'][number];
export type FinancePolicyPage = OperationOutputFor<'finance.policies.read'>;
export type FinancePolicyPreview = OperationOutputFor<'finance.policies.preview'>;
export type FinanceRepair = OperationOutputFor<'finance.reconciliationrepairs.read'>['items'][number];
export type FinanceRepairPage = OperationOutputFor<'finance.reconciliationrepairs.read'>;
export type FinanceRepairPreview = OperationOutputFor<'finance.reconciliationrepairs.preview'>;
export type FinanceEntryDraft = FinancePolicy['entries'][number];
type PolicyTargetStatus = Exclude<FinancePolicy['status'], 'draft'>;

export interface PolicyDraft {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly entries: readonly FinanceEntryDraft[];
  readonly effectiveDate: string;
  readonly expiresDate: string;
  readonly sampleFrom: string;
  readonly sampleTo: string;
  readonly expectedVersion: number;
  readonly targetStatus: PolicyTargetStatus;
}

export interface RepairDraft {
  readonly statementId: string;
  readonly sourceJournalId: string;
  readonly sourceHash: string;
  readonly entries: readonly FinanceEntryDraft[];
  readonly reason: string;
  readonly expectedVersion: number;
}

export type RepairDecision = FinanceRepairDecision;
export type FinanceGovernanceReceipt = Readonly<{ reference: string; state: string; version: number }>;

export function blankPolicy(id: string): PolicyDraft {
  const today = new Date().toISOString().slice(0, 10);
  return Object.freeze({
    id: `financepolicy:${id}`,
    name: '',
    trigger: '',
    entries: balancedEntries(),
    effectiveDate: today,
    expiresDate: '',
    sampleFrom: today,
    sampleTo: dateAfter(today, 30),
    expectedVersion: 1,
    targetStatus: 'active',
  });
}

export function editPolicy(policy: FinancePolicy, targetStatus: PolicyDraft['targetStatus'] = policy.status === 'retired' ? 'retired' : 'active'): PolicyDraft {
  return Object.freeze({
    id: policy.id,
    name: policy.name,
    trigger: policy.trigger,
    entries: Object.freeze(policy.entries.map((entry) => Object.freeze({ ...entry }))),
    effectiveDate: policy.effectiveAt.slice(0, 10),
    expiresDate: policy.expiresAt?.slice(0, 10) ?? '',
    sampleFrom: new Date().toISOString().slice(0, 10),
    sampleTo: dateAfter(new Date().toISOString().slice(0, 10), 30),
    expectedVersion: policy.version,
    targetStatus,
  });
}

export function blankRepair(): RepairDraft {
  return Object.freeze({ statementId: '', sourceJournalId: '', sourceHash: '', entries: balancedEntries(), reason: '', expectedVersion: 1 });
}

export function balancedEntries(): readonly FinanceEntryDraft[] {
  return Object.freeze([
    Object.freeze({ account: 'expense.goods', debitMinor: 100, creditMinor: 0, currency: 'CNY', memo: '修复借方' }),
    Object.freeze({ account: 'liability.payable', debitMinor: 0, creditMinor: 100, currency: 'CNY', memo: '修复贷方' }),
  ]);
}

export function validateEntries(entries: readonly FinanceEntryDraft[]): string | undefined {
  if (entries.length < 2 || entries.length > 100) return '请至少填写一借一贷，且分录不得超过 100 条。';
  let debit = 0;
  let credit = 0;
  for (const entry of entries) {
    if (!/^[a-z][a-z0-9]*(?:[.:][a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(entry.account) || !entry.memo.trim()) return '请填写有效的科目代码和分录说明。';
    if (![entry.debitMinor, entry.creditMinor].every((value) => Number.isSafeInteger(value) && value >= 0) || (entry.debitMinor === 0) === (entry.creditMinor === 0)) return '每条分录只能填写借方或贷方中的一项，金额必须为非负整数分。';
    if (entry.currency !== 'CNY') return '当前治理流程只允许人民币分录。';
    debit += entry.debitMinor;
    credit += entry.creditMinor;
  }
  return debit > 0 && debit === credit ? undefined : '借方合计必须等于贷方合计，且金额必须大于 0。';
}

export function policyValidation(draft: PolicyDraft): string | undefined {
  if (!/^financepolicy:[A-Za-z0-9:.-]{1,220}$/.test(draft.id)) return '政策编号无效。';
  if (draft.name.trim().length < 2 || draft.name.length > 200) return '政策名称需填写 2 至 200 个字符。';
  if (draft.trigger.trim().length < 2 || draft.trigger.length > 200) return '请填写清晰的业务触发条件。';
  if (!dateRange(draft.effectiveDate, draft.expiresDate || undefined)) return '政策失效日必须晚于生效日。';
  if (!dateRange(draft.sampleFrom, draft.sampleTo)) return '样本结束日必须晚于开始日。';
  if (!Number.isSafeInteger(draft.expectedVersion) || draft.expectedVersion < 1) return '政策版本无效，请刷新后重试。';
  return validateEntries(draft.entries);
}

export function repairValidation(draft: RepairDraft): string | undefined {
  if (!draft.statementId.startsWith('statement:')) return '请输入服务端账单编号。';
  if (!draft.sourceJournalId.startsWith('journal:')) return '请输入要冲正的来源凭证编号。';
  if (!/^[a-f0-9]{64}$/.test(draft.sourceHash)) return '账单校验值必须是 64 位小写 SHA-256。';
  if (!Number.isSafeInteger(draft.expectedVersion) || draft.expectedVersion < 1) return '账单版本无效，请刷新后重试。';
  if (draft.reason.trim().length < 2 || draft.reason.length > 1_000) return '请填写 2 至 1000 个字符的修复原因。';
  return validateEntries(draft.entries);
}

export function isoDay(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function dateRange(start: string, end: string | undefined): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(start) && (end === undefined || (/^\d{4}-\d{2}-\d{2}$/.test(end) && end > start));
}

function dateAfter(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
