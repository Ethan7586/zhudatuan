import { formatMinor } from '../../../shared/ui/Format';
import type { VoucherRecord, VoucherView } from '../model/Voucher';

export interface VoucherViewMeta { readonly label: string; readonly description: string; readonly short: string; readonly search: string; }
export const voucherViewMeta: Readonly<Record<VoucherView, VoucherViewMeta>> = Object.freeze({
  products: { label: '卡券产品', short: '产品', description: '面值、资格、有效期、激活方式和版本', search: '搜索产品名称、编号或详情' },
  pools: { label: '卡号库', short: '卡号', description: '凭证来源、容量、供给和关闭状态', search: '搜索卡号库名称或编号' },
  credentials: { label: '安全凭证', short: '凭证', description: '仅展示掩码、指纹和密钥版本', search: '搜索掩码或凭证编号' },
  stocks: { label: '库存申请', short: '库存', description: '客户库存额度、审批和履约状态', search: '搜索申请单号或客户' },
  issues: { label: '发放任务', short: '发放', description: '用途、领取方式、批次进度和失败恢复', search: '搜索发放单号或详情' },
  vouchers: { label: '卡券实例', short: '卡券', description: '持有人、余额、状态和有效期', search: '搜索卡券掩码、编号或持有人' },
  redemptions: { label: '核销与退款', short: '核销', description: '按回执编号查询核销金额与退款守恒', search: '输入完整核销回执编号后查询' },
  actions: { label: '批量操作', short: '批量', description: '激活、停用、恢复、作废和延期的逐项进度', search: '搜索操作批次编号或详情' },
  search: { label: '统一检索', short: '检索', description: '跨产品、卡号库、客户、持有人和状态筛选', search: '输入卡券、产品、客户或持有人关键字' },
});

export const voucherLifecycle = Object.freeze([
  { key: 'product', label: '产品', role: '定义资格与有效期' }, { key: 'pool', label: '卡号库', role: '生成或安全导入' },
  { key: 'stock', label: '库存申请', role: '审批可发额度' }, { key: 'issue', label: '发放', role: '批次分配与绑定' },
  { key: 'active', label: '持有与冻结', role: '激活、绑定和 Hold' }, { key: 'redeem', label: '核销与退款', role: '金额守恒并留痕' },
]);
export type VoucherTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
const labels: Readonly<Record<string, string>> = Object.freeze({ draft: '草稿', enabled: '已启用', disabled: '已停用', retired: '已退役', open: '开放', closed: '已关闭', generated: '已生成', available: '可用', allocated: '已分配', bound: '已绑定', active: '可使用', held: '核销冻结中', redeemed: '已核销', void: '已作废', reversed: '已冲正', expired: '已过期', submitted: '待审批', approved: '已审批', rejected: '已驳回', cancelled: '已取消', fulfilled: '已履约', issuing: '发放中', completed: '已完成', failed: '失败', queued: '等待执行', running: '执行中', succeeded: '已成功', partiallyrefunded: '部分退款', refunded: '已退款', pendingapproval: '待审批', expiredexport: '已过期', unknown: '待识别' });
const success = new Set(['enabled', 'open', 'available', 'active', 'approved', 'fulfilled', 'completed', 'succeeded', 'refunded']);
const warning = new Set(['submitted', 'allocated', 'bound', 'held', 'issuing', 'queued', 'running', 'pendingapproval', 'partiallyrefunded']);
const danger = new Set(['failed', 'rejected']);
export function voucherStateLabel(value: string): string { return labels[value.toLowerCase()] ?? `状态：${value}`; }
export function voucherStateTone(value: string): VoucherTone { const state = value.toLowerCase(); return success.has(state) ? 'success' : warning.has(state) ? 'warning' : danger.has(state) ? 'danger' : state === 'draft' ? 'info' : 'neutral'; }
export interface VoucherSummaryMetric { readonly label: string; readonly value: string; readonly hint: string; readonly tone: VoucherTone; }
export function voucherSummary(view: VoucherView, rows: readonly VoucherRecord[]): readonly VoucherSummaryMetric[] {
  const healthy = rows.filter((row) => voucherStateTone(row.state) === 'success').length;
  const attention = rows.filter((row) => ['warning', 'danger'].includes(voucherStateTone(row.state))).length;
  const quantity = rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
  const amount = rows.reduce((sum, row) => sum + (row.amountMinor ?? 0), 0);
  return Object.freeze([
    { label: '本页记录', value: format(rows.length), hint: voucherViewMeta[view].description, tone: 'info' },
    { label: '正常 / 完成', value: format(healthy), hint: '按权威服务端状态归类', tone: 'success' },
    { label: '待处理 / 异常', value: format(attention), hint: '含审批、执行中和失败', tone: attention ? 'warning' : 'neutral' },
    { label: quantity ? '本页业务数量' : '本页金额', value: quantity ? format(quantity) : amount ? formatMinor(amount, 'CNY') : '—', hint: '只汇总当前游标页，不代表全量', tone: 'neutral' },
  ]);
}
function format(value: number): string { return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value); }
