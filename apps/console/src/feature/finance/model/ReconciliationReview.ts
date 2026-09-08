import type { ContractJsonValue } from '@shop/contract/schema';
import type { FinanceReconciliation, FinanceReconciliationItem } from './Finance';

export interface ReconciliationEvidenceFact {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly technical: boolean;
}

export interface ReconciliationSuggestion {
  readonly title: string;
  readonly summary: string;
  readonly checks: readonly string[];
}

export type ReconciliationStepState = 'done' | 'current' | 'waiting';

export interface ReconciliationStep {
  readonly key: string;
  readonly label: string;
  readonly detail: string;
  readonly actor: string | null;
  readonly state: ReconciliationStepState;
}

const evidenceLabels: Readonly<Record<string, string>> = Object.freeze({
  reference: '业务凭证',
  paymentreference: '支付凭证',
  orderreference: '订单凭证',
  providerreference: '渠道凭证',
  statementreference: '渠道账单',
  channelline: '渠道明细',
  matchrule: '匹配规则',
  matchedby: '匹配依据',
  source: '数据来源',
  receivedat: '接收时间',
  currency: '币种',
  amountminor: '金额（最小货币单位）',
  traceid: '追踪编号',
  sourcehash: '来源校验值',
  statementhash: '账单校验值',
});

export function reconciliationEvidence(row: FinanceReconciliation, item: FinanceReconciliationItem): readonly ReconciliationEvidenceFact[] {
  const facts: ReconciliationEvidenceFact[] = [];
  collectEvidence(row.evidence, 'batch', facts);
  collectEvidence(item.evidence, 'item', facts);
  return Object.freeze(facts);
}

export function reconciliationResolution(item: FinanceReconciliationItem): readonly ReconciliationEvidenceFact[] {
  const facts: ReconciliationEvidenceFact[] = [];
  collectEvidence(item.resolution, 'resolution', facts);
  return Object.freeze(facts);
}

export function reconciliationSuggestion(item: FinanceReconciliationItem): ReconciliationSuggestion {
  const reason = (item.reasonCode ?? '').toLowerCase().replaceAll('-', '_');
  if (reason.includes('internal_reference') || reason.includes('mapping')) {
    return Object.freeze({
      title: '补齐业务映射后重新匹配',
      summary: '渠道明细存在，但系统内没有可验证的业务引用。先核对渠道凭证与订单或支付记录，再提交差异处理。',
      checks: Object.freeze(['核对渠道单号、支付单号与订单号是否属于同一业务', '确认金额、币种和账期一致', '仅在证据完整时提交映射或修复建议']),
    });
  }
  if (reason.includes('journal') || reason.includes('ledger')) {
    return Object.freeze({
      title: '核对支付事实与账本凭证',
      summary: '渠道侧已有资金事实，但账本侧缺少或无法匹配对应凭证。修复必须追加平衡分录，不能覆盖历史账目。',
      checks: Object.freeze(['确认支付或退款事实已最终落定', '核对事件投递与账本入账水位', '预览修复分录并确认借贷平衡后再送审']),
    });
  }
  if (reason.includes('amount') || reason.includes('minor')) {
    return Object.freeze({
      title: '核对金额口径与费用拆分',
      summary: '内外部金额不一致。优先核对手续费、退款、税额和币种最小单位，不直接修改账本余额。',
      checks: Object.freeze(['确认渠道金额是否包含手续费或退款', '确认币种和最小货币单位', '把差额定位到可证明的业务明细']),
    });
  }
  return Object.freeze({
    title: '先补齐证据，再选择处理方式',
    summary: '当前原因没有专用建议。请以渠道原始账单、系统业务事实和账本凭证三方证据为准。',
    checks: Object.freeze(['核对渠道原始凭证', '核对系统业务引用与账期', '无法证明时保持差异状态并交由复核人处理']),
  });
}

export function reconciliationTimeline(row: FinanceReconciliation, item: FinanceReconciliationItem): readonly ReconciliationStep[] {
  const hasResolution = item.resolution !== null && item.resolution !== undefined;
  const itemApproved = Boolean(item.approvedBy);
  const batchComplete = Boolean(row.approvedBy) || ['approved', 'balanced', 'completed'].includes(row.state);
  return Object.freeze([
    step('matched', '导入并匹配账单', '服务端已保存渠道账单校验值并完成本轮匹配。', row.createdBy, 'done'),
    step('difference', '发现并分类差异', item.reasonCode ? `差异分类：${item.reasonCode}` : '服务端已记录差异，但尚未给出分类代码。', null, 'done'),
    step('resolution', '提交处理建议', hasResolution ? '经办人已提交处理依据，等待或已经完成复核。' : '等待经办人补齐证据并提交处理建议。', item.resolvedBy ?? null, hasResolution ? 'done' : 'current'),
    step('approval', '复核处理建议', itemApproved ? '复核人已批准该差异处理。' : '批准人与提交人必须不同；未批准前不会形成修复结果。', item.approvedBy ?? null, itemApproved ? 'done' : hasResolution ? 'current' : 'waiting'),
    step('recheck', '重新匹配并收口', batchComplete ? '批次已重新核对并完成批准。' : '处理获批后由服务端重新匹配，结果仍以权威批次状态为准。', row.approvedBy ?? null, batchComplete ? 'done' : itemApproved ? 'current' : 'waiting'),
  ]);
}

function collectEvidence(value: ContractJsonValue | null | undefined, prefix: string, output: ReconciliationEvidenceFact[], depth = 0): void {
  if (value === null || value === undefined) return;
  if (isJsonArray(value)) {
    value.forEach((entry, index) => collectEvidence(entry, `${prefix}.${index + 1}`, output, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach((key) => collectEvidence(value[key], `${prefix}.${key}`, output, depth + 1));
    return;
  }
  const key = prefix.split('.').at(-1) ?? prefix;
  const normalized = key.replaceAll('_', '').toLowerCase();
  output.push(
    Object.freeze({
      key: prefix,
      label: evidenceLabels[normalized] ?? (depth > 1 ? '补充证据' : '批次证据'),
      value: String(value),
      technical: normalized.includes('hash') || normalized.includes('trace'),
    })
  );
}

function isJsonArray(value: ContractJsonValue): value is readonly ContractJsonValue[] {
  return Array.isArray(value);
}

function step(key: string, label: string, detail: string, actor: string | null, state: ReconciliationStepState): ReconciliationStep {
  return Object.freeze({ key, label, detail, actor, state });
}
