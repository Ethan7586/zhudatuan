import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
export type { PaymentTenderPlan } from './PaymentPlan';

import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import type { WechatScene } from '@shop/config/server';

export interface PreparedPayment {
  readonly intent: string;
  readonly external: boolean;
  readonly expiresAt: string;
}

export type CheckoutPaymentResult =
  | Readonly<{ paymentId: string; state: 'captured' }>
  | Readonly<{ paymentId: string; state: 'preparing'; expiresAt: string }>
  | Readonly<{ paymentId: string; state: 'pending'; action: Readonly<Record<string, string>>; expiresAt: string }>
  | Readonly<{ paymentId: string; state: 'recovery'; retryAfter: number }>;

export interface CheckoutPaymentPort {
  prepare(
    context: WriteTransactionContext,
    input: Readonly<{ order: string; orderNumber: string; scope: string; mall: string; member: string; currency: string; amountMinor: number; idempotency: string; tenders: readonly import('./PaymentPlan').PaymentTenderPlan[] }>
  ): Promise<PreparedPayment>;
  capture(
    context: WriteTransactionContext,
    input: Readonly<{ payment: PreparedPayment; order: string; scope: string; mall: string; member: string; currency: string; amountMinor: number; snapshot: unknown }>
  ): Promise<CheckoutPaymentResult>;
  continue(request: OperationRequest, input: Readonly<{ payment: PreparedPayment; order: string; scene: WechatScene }>): Promise<CheckoutPaymentResult>;
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
}
export interface FinancePaymentMatch {
  readonly reference: string;
  readonly kind: 'payment' | 'refund';
  readonly id: string;
  readonly amountMinor: number;
}
export const CHECKOUT_PAYMENT_PORT = publicPort<CheckoutPaymentPort>('payment', 'checkout');
export const FINANCE_PAYMENT_PORT = publicPort<FinancePaymentPort>('payment', 'finance');
export const ORDER_EXPIRY_PAYMENT_PORT = publicPort<OrderExpiryPaymentPort>('payment', 'orderexpiry');
export const ORDER_EXPIRY_HOLD_PORT = publicPort<PaymentHoldReleasePort>('payment', 'orderexpiryhold');
