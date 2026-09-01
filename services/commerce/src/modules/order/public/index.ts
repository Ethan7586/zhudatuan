import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { GetOrderSummary } from '../application/service/GetOrderSummary';

export type { CreateOrderIntent, OrderLineSnapshot } from './OrderIntent';
export type { GetOrderSummary } from '../application/service/GetOrderSummary';
export interface CheckoutOrderPort {
  purchases(context: ReadTransactionContext, member: string): Promise<readonly CheckoutPurchase[]>;
  create(context: WriteTransactionContext, input: import('./OrderIntent').CreateOrderIntent): Promise<Readonly<{ number: string; record: Record<string, unknown> }>>;
  scheduleExpiry(context: WriteTransactionContext, order: string, scope: string): Promise<void>;
}
export interface CheckoutPurchase {
  readonly listing: string;
  readonly dayQuantity: number;
  readonly weekQuantity: number;
  readonly monthQuantity: number;
  readonly lifetimeQuantity: number;
  readonly dayMinor: number;
  readonly weekMinor: number;
  readonly monthMinor: number;
  readonly lifetimeMinor: number;
}
export interface PaymentOrderPort {
  payment(context: ReadTransactionContext, order: string, member?: string): Promise<PaymentOrderSnapshot | null>;
  lockPayment(context: WriteTransactionContext, order: string, member?: string): Promise<PaymentOrderSnapshot | null>;
  aftersale(context: ReadTransactionContext, aftersale: string): Promise<PaymentAfterSaleSnapshot | null>;
  lockAfterSale(context: WriteTransactionContext, aftersale: string): Promise<PaymentAfterSaleSnapshot | null>;
  numbers(context: ReadTransactionContext, orders: readonly string[]): Promise<Readonly<Record<string, string>>>;
  paymentState(context: WriteTransactionContext, order: string): Promise<string>;
  markPaid(context: WriteTransactionContext, order: string): Promise<void>;
  markAuthorizing(context: WriteTransactionContext, order: string): Promise<void>;
  resetPayment(context: WriteTransactionContext, order: string): Promise<void>;
  markRefunded(context: WriteTransactionContext, input: Readonly<{ order: string; refundedMinor: number; capturedMinor: number; aftersale: string | null }>): Promise<void>;
  fulfillment(context: ReadTransactionContext, order: string): Promise<readonly OrderFulfillmentPlan[]>;
}
export interface PaymentJobOrderPort {
  markLatePaid(context: WriteTransactionContext, order: string): Promise<void>;
  cancelUnpaid(context: WriteTransactionContext, order: string): Promise<void>;
  resetPayment(context: WriteTransactionContext, order: string): Promise<void>;
  startAftersaleRefund(context: WriteTransactionContext, aftersale: string): Promise<void>;
}
export interface PaymentOrderSnapshot {
  readonly id: string;
  readonly number: string;
  readonly scope: string;
  readonly mall: string;
  readonly member: string;
  readonly currency: string;
  readonly totalMinor: number;
  readonly paymentState: string;
  readonly lifecycleState: string;
}
export interface PaymentAfterSaleSnapshot {
  readonly id: string;
  readonly order: string;
  readonly scope: string;
  readonly mall: string;
  readonly member: string;
  readonly line: string | null;
  readonly amountMinor: number | null;
  readonly reason: string;
  readonly state: string;
}
export interface FulfillmentOrderPort {
  completeFulfillment(context: WriteTransactionContext, order: string, lines: readonly Readonly<{ line: string; quantity: number }>[]): Promise<void>;
  snapshot(context: ReadTransactionContext, order: string): Promise<OrderFulfillmentSnapshot | null>;
  lineSkus(context: ReadTransactionContext, order: string, lines: readonly string[]): Promise<readonly OrderFulfillmentLine[]>;
  returnRequest(context: ReadTransactionContext, aftersale: string): Promise<FulfillmentAfterSaleSnapshot | null>;
  markReturning(context: WriteTransactionContext, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void>;
  markReceived(context: WriteTransactionContext, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void>;
  markRefunding(context: WriteTransactionContext, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void>;
  recordInspection(context: WriteTransactionContext, aftersale: string, returned: string, accepted: boolean, actor: string): Promise<void>;
}
export interface OrderFulfillmentLine {
  readonly line: string;
  readonly sku: string;
}
export interface OrderFulfillmentSnapshot {
  readonly id: string;
  readonly scope: string;
  readonly member: string;
}
export interface FulfillmentAfterSaleSnapshot {
  readonly id: string;
  readonly order: string;
  readonly scope: string;
  readonly member: string;
  readonly reason: string;
  readonly state: string;
  readonly requiresReturn: boolean;
  readonly lines: readonly Readonly<{ line: string; quantity: number; provider: string | null; policy: Readonly<Record<string, unknown>> }>[];
}
export interface AfterSaleReturnEvidence {
  readonly id: string;
  readonly state: string;
  readonly provider: string | null;
  readonly providerReference: string | null;
  readonly trackingNumber: string | null;
  readonly instruction: Readonly<Record<string, unknown>>;
}
export interface OrderFulfillmentPlan {
  readonly suborder: string;
  readonly provider: string | null;
  readonly partner: string | null;
  readonly kind: 'digital' | 'shipment';
  readonly amountMinor: number;
  readonly lines: readonly Readonly<{ line: string; quantity: number }>[];
}
export interface OrderExpiryPort {
  cancelUnpaid(context: WriteTransactionContext, order: string): Promise<void>;
  expirable(context: WriteTransactionContext, orders: readonly string[]): Promise<readonly OrderExpirySnapshot[]>;
}
export interface OrderExpirySnapshot {
  readonly id: string;
  readonly scope: string;
}
export const CHECKOUT_ORDER_PORT = publicPort<CheckoutOrderPort>('order', 'checkout');
export const PAYMENT_ORDER_PORT = publicPort<PaymentOrderPort>('order', 'payment');
export const FULFILLMENT_ORDER_PORT = publicPort<FulfillmentOrderPort>('order', 'fulfillment');
export const SUPPORT_ORDER_PORT = publicPort<Pick<GetOrderSummary, 'execute'>>('order', 'support');
export const ORDER_EXPIRY_ORDER_PORT = publicPort<OrderExpiryPort>('order', 'orderexpiry');
export const PAYMENT_JOB_ORDER_PORT = publicPort<PaymentJobOrderPort & PaymentOrderPort>('order', 'paymentjob');
export { ORDER_RECEIPT_PORT, type OrderReceiptPort } from './OrderReceiptPort';
export { ORDER_READ_PORT, type OrderReadPort, type OrderSummary } from './OrderReadPort';
export { PAYMENT_WEBHOOK_ORDER_PORT, type PaymentWebhookOrderPort } from './PaymentWebhookOrderPort';
