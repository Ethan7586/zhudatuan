import { formatMinor } from '../../shared/ui/Format';
import type { VoucherRecord, VoucherView } from './VoucherSchema';

export interface VoucherViewMeta {
  readonly label: string;
  readonly description: string;
  readonly short: string;
}

export const voucherViewMeta: Readonly<Record<VoucherView, VoucherViewMeta>> = Object.freeze({
  programs: Object.freeze({ label: '卡券方案', short: '方案', description: '面值、审批要求与方案版本' }),
  libraries: Object.freeze({ label: '卡号库', short: '卡号', description: '卡号生成、导入结果与可用数量' }),
  reserves: Object.freeze({ label: '备券申请', short: '备券', description: '额度申请、审批状态与申请金额' }),
  batches: Object.freeze({ label: '发行批次', short: '发行', description: '批次进度、已发行数量与失败状态' }),
});

export const voucherLifecycle = Object.freeze([
  Object.freeze({ key: 'draft', label: '草稿', role: '卡券运营编辑' }),
  Object.freeze({ key: 'review', label: '待审核', role: '管理员审批' }),
  Object.freeze({ key: 'scheduled', label: '待开始', role: '系统等待生效' }),
  Object.freeze({ key: 'active', label: '进行中', role: '会员可领可用' }),
  Object.freeze({ key: 'paused', label: '已暂停', role: '管理员可恢复' }),
  Object.freeze({ key: 'ended', label: '已结束', role: '只读留痕审计' }),
]);

export type VoucherTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const stateLabels: Readonly<Record<string, string>> = Object.freeze({
  active: '进行中',
  ready: '可用',
  approved: '已审批',
  completed: '已完成',
  fulfilled: '已履约',
  draft: '草稿',
  submitted: '待审批',
  approval: '待审核',
  scheduled: '待开始',
  issuing: '发行中',
  paused: '已暂停',
  retired: '已结束',
  depleted: '已用尽',
  disabled: '已停用',
  rejected: '已驳回',
  failed: '失败',
  cancelled: '已取消',
  imported: '已导入',
  generated: '系统生成',
  processing: '处理中',
});

const successStates = new Set(['active', 'ready', 'approved', 'completed', 'fulfilled', 'imported', 'generated']);
const warningStates = new Set(['submitted', 'approval', 'scheduled', 'issuing', 'paused', 'processing']);
const dangerStates = new Set(['failed', 'rejected']);
const infoStates = new Set(['draft']);

export function voucherStateLabel(value: string): string {
  return stateLabels[value.toLowerCase()] ?? '待识别状态';
}

export function voucherStateTone(value: string): VoucherTone {
  const normalized = value.toLowerCase();
  if (successStates.has(normalized)) return 'success';
  if (warningStates.has(normalized)) return 'warning';
  if (dangerStates.has(normalized)) return 'danger';
  if (infoStates.has(normalized)) return 'info';
  return 'neutral';
}

export interface VoucherSummaryMetric {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly tone: VoucherTone;
}

export function voucherSummary(view: VoucherView, rows: readonly VoucherRecord[]): readonly VoucherSummaryMetric[] {
  const healthy = rows.filter((row) => voucherStateTone(row.state) === 'success').length;
  const pending = rows.filter((row) => ['warning', 'danger'].includes(voucherStateTone(row.state))).length;
  const business = businessMetric(view, rows);
  return Object.freeze([
    Object.freeze({ label: '本页记录', value: formatCount(rows.length), hint: voucherViewMeta[view].description, tone: 'info' as const }),
    Object.freeze({ label: '可用 / 完成', value: formatCount(healthy), hint: '按服务端状态归类', tone: 'success' as const }),
    Object.freeze({ label: '待处理 / 异常', value: formatCount(pending), hint: '含审核、处理中与失败', tone: pending > 0 ? ('warning' as const) : ('neutral' as const) }),
    business,
  ]);
}

function businessMetric(view: VoucherView, rows: readonly VoucherRecord[]): VoucherSummaryMetric {
  if (view === 'programs') {
    const amounts = rows.filter((row) => row.amountMinor !== null && row.currency !== null);
    const currencies = new Set(amounts.map((row) => row.currency));
    const value =
      currencies.size === 1
        ? formatMinor(
            amounts.reduce((sum, row) => sum + (row.amountMinor ?? 0), 0),
            amounts[0]?.currency ?? 'CNY'
          )
        : currencies.size > 1
          ? '多币种'
          : '—';
    return Object.freeze({ label: '本页面值合计', value, hint: '仅汇总当前页同币种面值', tone: 'neutral' });
  }
  const quantity = rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
  const labels: Readonly<Record<Exclude<VoucherView, 'programs'>, readonly [string, string]>> = Object.freeze({
    libraries: ['本页可用卡号', '成功数量优先，缺失时使用总量'],
    reserves: ['本页申请数量', '来自备券申请读模型'],
    batches: ['本页已发行', '来自发行批次读模型'],
  });
  const [label, hint] = labels[view];
  return Object.freeze({ label, value: formatCount(quantity), hint, tone: 'neutral' });
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
}
