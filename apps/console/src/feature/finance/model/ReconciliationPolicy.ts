import type { FinanceReconciliation, FinanceReconciliationAction } from './Finance';

export type ReconciliationCommandOption = Readonly<{ value: FinanceReconciliationAction; label: string }>;

export function availableReconciliationCommands(row: FinanceReconciliation | undefined, item: FinanceReconciliation['items'][number] | undefined): readonly ReconciliationCommandOption[] {
  if (!row) return [];
  const commands: ReconciliationCommandOption[] = [];
  if (row.state === 'difference' || row.state === 'resolved') commands.push({ value: 'retry', label: '重新匹配' });
  if (item?.state === 'difference') commands.push({ value: 'resolve', label: '提交差异处理' });
  if (item?.state === 'resolutionpending') commands.push({ value: 'approveitem', label: '批准差异处理' });
  if (row.state === 'balanced' || row.state === 'resolved') commands.push({ value: 'approve', label: '批准对账批次' });
  return Object.freeze(commands);
}

export function validateReconciliationCommand(
  row: FinanceReconciliation | undefined,
  item: FinanceReconciliation['items'][number] | undefined,
  options: readonly ReconciliationCommandOption[],
  action: FinanceReconciliationAction,
  reason: string,
  proof: string,
  confirmed: boolean
): string | undefined {
  if (!row || options.length === 0) return undefined;
  if (!options.some((option) => option.value === action)) return '当前状态不允许执行该操作。';
  if ((action === 'resolve' || action === 'approveitem') && item === undefined) return '请选择要处理的差异明细。';
  if (!reason.trim() || reason.trim().length > 1000) return '请填写 1 至 1000 字的处理原因。';
  if (!confirmed) return '请核对对账批次、差异金额和处理方式。';
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(proof)) return '请输入 Step-up 后签发的一次性操作凭证。';
  return undefined;
}

export function reconciliationMessage(action: FinanceReconciliationAction): string {
  if (action === 'retry') return '对账批次已重新进入匹配队列并完成权威回读。';
  if (action === 'resolve') return '差异处理已提交复核并完成权威回读。';
  if (action === 'approveitem') return '差异处理已由复核人批准并完成权威回读。';
  return '对账批次已批准，结算任务已按服务端规则调度。';
}
