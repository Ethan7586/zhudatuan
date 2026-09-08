import { chineseDomainLabel, chineseProviderLabel } from '@shop/presentation';
import type { OrderPaymentTender, OrderRecord } from '../model/Order';

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

export const paymentLabel = (value: string): string => paymentLabels[value] ?? '待识别状态';
export const fulfillmentLabel = (value: string): string => fulfillmentLabels[value] ?? '待识别状态';
export const aftersaleLabel = (value: string): string => aftersaleLabels[value] ?? '待识别状态';
export const lifecycleLabel = (value: string): string => lifecycleLabels[value] ?? '待识别状态';
export { afterSaleReasonText as aftersaleReasonLabel } from '@shop/presentation';

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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replaceAll('/', '-');
}

export function providerLabel(provider: string | null, partnerName: string | null): string {
  return provider ? chineseProviderLabel(provider) : (partnerName ?? '平台自营');
}

export function tenderLabel(kind: OrderPaymentTender['kind']): string {
  return kind === 'wechat' ? '微信支付' : kind === 'benefit' ? '福利账户' : '福利券';
}

export function addressLabel(order: Pick<OrderRecord, 'address'>): string {
  return order.address ? `${order.address.recipientMasked} · ${order.address.mobileMasked} · ${order.address.addressMasked}${order.address.regionCode ? `（${order.address.regionCode}）` : ''}` : '本单无需配送地址';
}

export function actionLabel(action: string): string {
  return chineseDomainLabel(action.replaceAll('.', ' '));
}

export function recoveryResourceLabel(value: string): string {
  return ({ intent: '支付意图', refund: '退款', deadletter: '失败任务' } as Readonly<Record<string, string>>)[value] ?? '支付资源';
}

export function recoveryLabel(value: string): string {
  const known: Readonly<Record<string, string>> = {
    PAYMENT_LATE_SUCCESS: '订单取消后支付成功',
    PAYMENT_PROVIDER_REFUNDED: '渠道已退款但本地状态未完成',
  };
  return known[value] ?? '未归类支付异常';
}

export function productSummary(order: OrderRecord): Readonly<{ title: string; detail: string }> {
  const lines = [...(order.lines ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  const first = lines[0];
  if (first === undefined) return { title: '商品明细不可用', detail: '当前订单快照未返回商品行' };
  const quantity = lines.reduce((total, line) => total + line.quantity, 0);
  return {
    title: first.title,
    detail: `共 ${quantity} 件${lines.length > 1 ? ` / ${lines.length} 类商品` : ''}`,
  };
}
