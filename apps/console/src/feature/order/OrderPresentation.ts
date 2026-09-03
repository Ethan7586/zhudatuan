import { chineseReference } from '@shop/presentation';
import type { OrderRecord } from './OrderSchema';

export type OrderTone = 'brand' | 'success' | 'warning' | 'danger' | 'muted';

const paymentLabels: Readonly<Record<string, string>> = Object.freeze({
  unpaid: '待付款',
  authorizing: '支付中',
  paid: '已支付',
  partially_refunded: '部分退款',
  refunded: '已退款',
  failed: '支付失败',
});

const fulfillmentLabels: Readonly<Record<string, string>> = Object.freeze({
  unallocated: '待分配',
  allocated: '待发货',
  processing: '履约中',
  shipped: '已发货',
  delivered: '已完成',
  received: '已收货',
  cancelled: '已取消',
  returned: '已退回',
});

const aftersaleLabels: Readonly<Record<string, string>> = Object.freeze({
  none: '无售后',
  applied: '已申请',
  reviewing: '审核中',
  approved: '已批准',
  returning: '退货中',
  received: '已收货',
  refunding: '退款中',
  resolved: '已完成',
  rejected: '已驳回',
});

const lifecycleLabels: Readonly<Record<string, string>> = Object.freeze({
  created: '已创建',
  awaitingpayment: '待支付',
  paid: '已支付',
  fulfilling: '履约中',
  shipped: '已发货',
  received: '已收货',
  completed: '已完成',
  cancelled: '已取消',
});

const aftersaleReasonLabels: Readonly<Record<string, string>> = Object.freeze({
  quality: '商品质量问题',
  damaged: '运输破损',
  wrongitem: '错发或漏发',
  notneeded: '不再需要',
  service: '服务未按约完成',
});

export const paymentLabel = (value: string): string => paymentLabels[value] ?? '待识别状态';
export const fulfillmentLabel = (value: string): string => fulfillmentLabels[value] ?? '待识别状态';
export const aftersaleLabel = (value: string): string => aftersaleLabels[value] ?? '待识别状态';
export const lifecycleLabel = (value: string): string => lifecycleLabels[value] ?? '待识别状态';
export const aftersaleReasonLabel = (value: string): string => aftersaleReasonLabels[value] ?? '其他售后原因';

export function paymentTone(value: string): OrderTone {
  if (value === 'paid') return 'brand';
  if (value === 'failed') return 'danger';
  if (value === 'partially_refunded' || value === 'refunded') return 'warning';
  return 'muted';
}

export function fulfillmentTone(value: string): OrderTone {
  if (value === 'delivered') return 'success';
  if (value === 'allocated') return 'warning';
  if (value === 'processing' || value === 'shipped') return 'brand';
  if (value === 'returned') return 'danger';
  return 'muted';
}

export function aftersaleTone(value: string): OrderTone {
  if (value === 'none') return 'muted';
  if (value === 'resolved') return 'success';
  if (value === 'rejected') return 'danger';
  return 'warning';
}

export function formatOrderTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace('/', '-');
}

export function productSummary(order: OrderRecord): Readonly<{ title: string; detail: string }> {
  const lines = [...(order.lines ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  const first = lines[0];
  if (first === undefined) return { title: '商品明细不可用', detail: '当前订单快照未返回商品行' };
  const quantity = lines.reduce((total, line) => total + line.quantity, 0);
  return {
    title: first.title,
    detail: `${chineseReference('商品规格', first.sku)} · 共 ${quantity} 件${lines.length > 1 ? ` / ${lines.length} 类` : ''}`,
  };
}
