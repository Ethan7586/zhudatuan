import type { OrderStatus } from './Order';

const ORDER_STATUS_TEXT: Readonly<Record<OrderStatus, string>> = Object.freeze({
  pending_payment: '待付款',
  pending_shipment: '待发货',
  pending_receipt: '待收货',
  completed: '已完成',
  after_sale: '售后处理中',
});

const PAYMENT_STATE_TEXT: Readonly<Record<string, string>> = Object.freeze({
  unpaid: '待付款',
  authorizing: '支付确认中',
  paid: '已付款',
  partially_refunded: '部分退款',
  refunded: '已退款',
  failed: '支付失败',
});

const FULFILLMENT_STATE_TEXT: Readonly<Record<string, string>> = Object.freeze({
  unallocated: '待分配履约方',
  allocated: '已分配履约方',
  processing: '备货中',
  shipped: '运输中',
  delivered: '已送达',
  received: '已签收',
  cancelled: '履约已取消',
  returned: '已退回',
});

const TIMELINE_STATE_TEXT: Readonly<Record<string, string>> = Object.freeze({
  created: '物流单已创建',
  allocated: '已分配履约方',
  processing: '商品备货中',
  shipped: '商品已发出',
  intransit: '运输途中',
  delivered: '商品已送达',
  received: '订单已签收',
  cancelled: '物流已取消',
  returned: '商品已退回',
});

export function orderStatusText(status: OrderStatus): string {
  return ORDER_STATUS_TEXT[status];
}

export function paymentStateText(state: string): string {
  return PAYMENT_STATE_TEXT[state] ?? '状态更新中';
}

export function fulfillmentStateText(state: string): string {
  return FULFILLMENT_STATE_TEXT[state] ?? '履约处理中';
}

export function timelineStateText(state: string): string {
  return TIMELINE_STATE_TEXT[state] ?? fulfillmentStateText(state);
}
