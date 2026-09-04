export const ORDER_STATUS = {
  pendingPayment: 'pending_payment',
  paid: 'paid',
  processing: 'processing',
  pendingShipment: 'pending_shipment',
  shipped: 'shipped',
  pendingReceipt: 'pending_receipt',
  completed: 'completed',
  cancelled: 'cancelled',
  refundPending: 'refund_pending',
  refunded: 'refunded',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const PAYMENT_STATUS = {
  notStarted: 'not_started',
  pending: 'pending',
  paid: 'paid',
  closed: 'closed',
  failed: 'failed',
  refunded: 'refunded',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export type WechatPaymentAttemptStatus = 'created' | 'prepay_ready' | 'prepay_failed' | 'processing' | 'succeeded' | 'closed' | 'failed';

/** Converts provider/storage detail into the one payment vocabulary exposed to every client. */
export function toPaymentStatus(attemptStatus: unknown, orderStatus?: unknown): PaymentStatus {
  if (orderStatus === ORDER_STATUS.refunded) return PAYMENT_STATUS.refunded;
  if (
    orderStatus === ORDER_STATUS.paid ||
    orderStatus === ORDER_STATUS.processing ||
    orderStatus === ORDER_STATUS.pendingShipment ||
    orderStatus === ORDER_STATUS.shipped ||
    orderStatus === ORDER_STATUS.pendingReceipt ||
    orderStatus === ORDER_STATUS.completed
  ) {
    return PAYMENT_STATUS.paid;
  }
  switch (attemptStatus) {
    case 'succeeded':
      return PAYMENT_STATUS.paid;
    case 'closed':
      return PAYMENT_STATUS.closed;
    case 'prepay_failed':
    case 'failed':
      return PAYMENT_STATUS.failed;
    case 'created':
    case 'prepay_ready':
    case 'processing':
      return PAYMENT_STATUS.pending;
    default:
      return PAYMENT_STATUS.notStarted;
  }
}

export interface OrderPaymentStatus {
  orderId: string;
  orderNo: string;
  orderStatus: OrderStatus;
  status: PaymentStatus;
  paidAt: string | null;
  providerTradeNo: string | null;
  totalCents: number;
  prepayExpiresAt: string | null;
  lastQueryAt: string | null;
}
