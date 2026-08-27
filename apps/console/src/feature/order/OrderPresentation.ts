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
  cancelled: '已取消',
  returned: '已退回',
});

const aftersaleLabels: Readonly<Record<string, string>> = Object.freeze({
  none: '无售后',
  requested: '申请中',
  processing: '处理中',
  resolved: '已完成',
  rejected: '已驳回',
});

const lifecycleLabels: Readonly<Record<string, string>> = Object.freeze({
  created: '已创建',
  active: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  closed: '已关闭',
});

export const paymentLabel = (value: string): string => paymentLabels[value] ?? value;
export const fulfillmentLabel = (value: string): string => fulfillmentLabels[value] ?? value;
export const aftersaleLabel = (value: string): string => aftersaleLabels[value] ?? value;
export const lifecycleLabel = (value: string): string => lifecycleLabels[value] ?? value;

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

export function previewRecord(order: OrderRecord, enabled: boolean): OrderRecord['preview'] | undefined {
  return enabled && order.preview?.source === 'local-preview' ? order.preview : undefined;
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
    detail: `${first.sku} · 共 ${quantity} 件${lines.length > 1 ? ` / ${lines.length} 类` : ''}`,
  };
}
