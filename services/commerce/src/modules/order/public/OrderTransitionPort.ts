import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';

export interface OrderPaymentPort {
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
  recordPayment(
    context: WriteTransactionContext,
    input: Readonly<{ order: string; payment: string; currency: string; capturedMinor: number; refundedMinor: number; state: string; version: number; tenders: readonly OrderPaymentTender[] }>
  ): Promise<void>;
  recordPaymentRefund(context: WriteTransactionContext, order: string, refundedMinor: number, capturedMinor: number, version: number): Promise<void>;
  recordRefund(context: WriteTransactionContext, input: OrderRefundProjection): Promise<void>;
}

export interface OrderPaymentJobPort extends OrderPaymentPort {
  markLatePaid(context: WriteTransactionContext, order: string): Promise<void>;
  cancelUnpaid(context: WriteTransactionContext, order: string): Promise<void>;
  startAftersaleRefund(context: WriteTransactionContext, aftersale: string): Promise<void>;
}

export interface OrderPaymentTender {
  readonly sequence: number;
  readonly kind: 'wechat' | 'benefit' | 'voucher';
  readonly reference: string | null;
  readonly amountMinor: number;
  readonly state: string;
}
export interface OrderRefundProjection {
  readonly id: string;
  readonly order: string;
  readonly aftersale: string | null;
  readonly provider: string;
  readonly providerReference: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly state: string;
  readonly reason: string;
  readonly tenders: readonly OrderPaymentTender[];
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

export interface OrderFulfillmentPort {
  fulfillment(context: ReadTransactionContext, order: string): Promise<readonly OrderFulfillmentPlan[]>;
  completeFulfillment(context: WriteTransactionContext, order: string, lines: readonly Readonly<{ line: string; quantity: number }>[]): Promise<void>;
  snapshot(context: ReadTransactionContext, order: string): Promise<OrderFulfillmentSnapshot | null>;
  lineSkus(context: ReadTransactionContext, order: string, lines: readonly string[]): Promise<readonly OrderFulfillmentLine[]>;
  storeWork(context: ReadTransactionContext, orders: readonly string[]): Promise<readonly OrderStoreWorkSnapshot[]>;
  returnRequest(context: ReadTransactionContext, aftersale: string): Promise<FulfillmentAfterSaleSnapshot | null>;
  markReturning(context: WriteTransactionContext, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void>;
  markReceived(context: WriteTransactionContext, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void>;
  markRefunding(context: WriteTransactionContext, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void>;
  recordInspection(context: WriteTransactionContext, aftersale: string, returned: string, accepted: boolean, actor: string): Promise<void>;
  recordFulfillments(context: WriteTransactionContext, order: string, items: readonly OrderFulfillmentProjection[]): Promise<void>;
  recordFulfillmentMilestones(context: WriteTransactionContext, order: string, fulfillment: string, items: readonly OrderFulfillmentMilestone[]): Promise<void>;
}
export interface OrderFulfillmentProjection {
  readonly id: string;
  readonly provider: string | null;
  readonly partner: string | null;
  readonly kind: 'shipment' | 'delivery' | 'pickup' | 'service' | 'digital';
  readonly state: string;
  readonly externalReference: string | null;
  readonly version: number;
}
export interface OrderFulfillmentMilestone {
  readonly id: string;
  readonly kind: string;
  readonly state: string;
  readonly tracking: string | null;
  readonly occurredAt: string;
}
export interface OrderFulfillmentLine {
  readonly line: string;
  readonly sku: string;
  readonly product: string;
}
export interface OrderStoreWorkSnapshot {
  readonly id: string;
  readonly number: string;
  readonly member: string;
  readonly lines: readonly Readonly<{ line: string; sku: string; title: string }>[];
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
  readonly version: number;
}
export interface OrderFulfillmentPlan {
  readonly suborder: string;
  readonly provider: string | null;
  readonly partner: string | null;
  readonly lines: readonly Readonly<{ line: string; quantity: number; payableMinor: number; productType: string }>[];
}

export interface OrderExpiryPort {
  cancelUnpaid(context: WriteTransactionContext, order: string): Promise<void>;
  expirable(context: WriteTransactionContext, orders: readonly string[]): Promise<readonly OrderExpirySnapshot[]>;
}
export interface OrderExpirySnapshot {
  readonly id: string;
  readonly scope: string;
}

export const ORDER_PAYMENT_PORT = publicPort<OrderPaymentPort>('order', 'payment');
export const ORDER_PAYMENT_JOB_PORT = publicPort<OrderPaymentJobPort>('order', 'paymentjob');
export const ORDER_FULFILLMENT_PORT = publicPort<OrderFulfillmentPort>('order', 'fulfillment');
export const ORDER_EXPIRY_PORT = publicPort<OrderExpiryPort>('order', 'expiry');
