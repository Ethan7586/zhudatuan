import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { GetOrderSummary } from '../application/GetOrderSummary';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
export type { CreateOrderIntent, OrderLineSnapshot } from '../OrderPort';
export type { GetOrderSummary } from '../application/GetOrderSummary';
export interface CheckoutOrderPort {
  purchases(database: OperationDatabase, member: string): Promise<readonly CheckoutPurchase[]>;
  create(database: OperationDatabase, input: import('../OrderPort').CreateOrderIntent): Promise<Readonly<{ number: string; record: Record<string, unknown> }>>;
  scheduleExpiry(database: OperationDatabase, order: string, scope: string): Promise<void>;
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
  payment(database: OperationDatabase, order: string, member?: string, lock?: boolean): Promise<PaymentOrderSnapshot | null>;
  aftersale(database: OperationDatabase, aftersale: string, lock?: boolean): Promise<PaymentAfterSaleSnapshot | null>;
  numbers(database: OperationDatabase, orders: readonly string[]): Promise<Readonly<Record<string, string>>>;
  paymentState(database: OperationDatabase, order: string): Promise<string>;
  markPaid(database: OperationDatabase, order: string): Promise<void>;
  markAuthorizing(database: OperationDatabase, order: string): Promise<void>;
  resetPayment(database: OperationDatabase, order: string): Promise<void>;
  markRefunded(database: OperationDatabase, input: Readonly<{ order: string; refundedMinor: number; capturedMinor: number; aftersale: string | null }>): Promise<void>;
  fulfillment(database: OperationDatabase, order: string): Promise<readonly OrderFulfillmentPlan[]>;
}
export interface PaymentJobOrderPort {
  markLatePaid(database: OperationDatabase, order: string): Promise<void>;
  cancelUnpaid(database: OperationDatabase, order: string): Promise<void>;
  resetPayment(database: OperationDatabase, order: string): Promise<void>;
  startAftersaleRefund(database: OperationDatabase, aftersale: string): Promise<void>;
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
  completeFulfillment(database: OperationDatabase, order: string, lines: readonly Readonly<{ line: string; quantity: number }>[]): Promise<void>;
  snapshot(database: OperationDatabase, order: string): Promise<OrderFulfillmentSnapshot | null>;
  lineSkus(database: OperationDatabase, order: string, lines: readonly string[]): Promise<readonly OrderFulfillmentLine[]>;
  returnRequest(database: OperationDatabase, aftersale: string): Promise<FulfillmentAfterSaleSnapshot | null>;
  markReturning(database: OperationDatabase, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void>;
  markReceived(database: OperationDatabase, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void>;
  markRefunding(database: OperationDatabase, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void>;
  recordInspection(database: OperationDatabase, aftersale: string, returned: string, accepted: boolean, actor: string): Promise<void>;
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
  cancelUnpaid(database: OperationDatabase, order: string): Promise<void>;
  expirable(database: OperationDatabase, orders: readonly string[]): Promise<readonly OrderExpirySnapshot[]>;
}
export interface OrderExpirySnapshot {
  readonly id: string;
  readonly scope: string;
}
export const CHECKOUT_ORDER_PORT = publicPort<CheckoutOrderPort>('order', 'checkout');
export const PAYMENT_ORDER_PORT = publicPort<PaymentOrderPort>('order', 'payment');
export const FULFILLMENT_ORDER_PORT = publicPort<FulfillmentOrderPort>('order', 'fulfillment');
export const SUPPORT_ORDER_PORT = publicPort<Pick<GetOrderSummary, 'execute'>>('order', 'support');
export { ORDER_RECEIPT_PORT, PgOrderReceiptPort, type OrderReceiptPort } from './OrderReceiptPort';
export { ORDER_READ_PORT, PgOrderReadPort, type OrderReadPort, type OrderSummary } from './OrderReadPort';
