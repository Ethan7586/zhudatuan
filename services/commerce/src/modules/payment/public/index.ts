import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';
export type { PaymentIntentCommand, PaymentIntentReceipt, PaymentPort, PaymentRefundCommand, PaymentScene, PaymentTenderPlan } from './PaymentPort';

import type { OperationRequest } from '../../../pipeline/OperationHandler';
import type { PaymentIntentReceipt, PaymentScene, PaymentTenderPlan } from './PaymentPort';

export type PreparedPayment = PaymentIntentReceipt;

export type CheckoutPaymentResult =
  | Readonly<{ paymentId: string; state: 'captured' }>
  | Readonly<{ paymentId: string; state: 'preparing'; expiresAt: string }>
  | Readonly<{ paymentId: string; state: 'pending'; action: Readonly<Record<string, string>>; expiresAt: string }>
  | Readonly<{ paymentId: string; state: 'recovery'; retryAfter: number }>;

export interface CheckoutPaymentPort {
  prepare(
    context: WriteTransactionContext,
    input: Readonly<{ order: string; orderNumber: string; scope: string; mall: string; member: string; currency: string; amountMinor: number; idempotency: string; tenders: readonly PaymentTenderPlan[] }>
  ): Promise<PreparedPayment>;
  capture(
    context: WriteTransactionContext,
    input: Readonly<{ payment: PreparedPayment; order: string; scope: string; mall: string; member: string; currency: string; amountMinor: number; snapshot: unknown }>
  ): Promise<CheckoutPaymentResult>;
  continue(request: OperationRequest, input: Readonly<{ payment: PreparedPayment; order: string; scene: PaymentScene }>): Promise<CheckoutPaymentResult>;
}
export interface OrderExpiryPaymentPort {
  expire(context: WriteTransactionContext, order: string | null): Promise<void>;
  expirations(context: ReadTransactionContext, order: string | null): Promise<readonly PaymentExpiration[]>;
}
export interface PaymentExpiration {
  readonly intent: string;
  readonly order: string;
  readonly external: boolean;
}
export interface PaymentHoldReleasePort {
  release(context: WriteTransactionContext, order: string): Promise<void>;
}
export interface FinancePaymentPort {
  externalAmount(context: ReadTransactionContext, kind: 'payment' | 'refund', reference: string): Promise<number>;
  reconciliation(context: ReadTransactionContext, references: readonly string[]): Promise<readonly FinancePaymentMatch[]>;
  orders(context: ReadTransactionContext, payments: readonly string[]): Promise<readonly FinancePaymentOrder[]>;
}
export interface OrderImportPaymentPort {
  verifyImportEvidence(context: ReadTransactionContext, reference: string, scope: string, amountMinor: number, currency: string): Promise<boolean>;
}
export interface FinancePaymentMatch {
  readonly reference: string;
  readonly kind: 'payment' | 'refund';
  readonly id: string;
  readonly amountMinor: number;
}
export interface FinancePaymentOrder {
  readonly payment: string;
  readonly order: string;
}
export const CHECKOUT_PAYMENT_PORT = publicPort<CheckoutPaymentPort>('payment', 'checkout');
export const CHECKOUT_HOLD_PORT = publicPort<PaymentHoldReleasePort>('payment', 'checkoutrelease');
export const FINANCE_PAYMENT_PORT = publicPort<FinancePaymentPort>('payment', 'finance');
export const ORDER_IMPORT_PAYMENT_PORT = publicPort<OrderImportPaymentPort>('payment', 'orderimport');
export const ORDER_EXPIRY_PAYMENT_PORT = publicPort<OrderExpiryPaymentPort>('payment', 'orderexpiry');
export const ORDER_EXPIRY_HOLD_PORT = publicPort<PaymentHoldReleasePort>('payment', 'orderexpiryhold');
