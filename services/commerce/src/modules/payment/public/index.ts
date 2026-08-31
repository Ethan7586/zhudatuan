import { publicPort } from '../../../bootstrap/ModuleRegistry';
export type { PaymentTenderPlan } from '../PaymentPort';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
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
    database: OperationDatabase,
    input: Readonly<{ order: string; orderNumber: string; scope: string; mall: string; member: string; currency: string; amountMinor: number; idempotency: string; tenders: readonly import('../PaymentPort').PaymentTenderPlan[] }>
  ): Promise<PreparedPayment>;
  capture(database: OperationDatabase, input: Readonly<{ payment: PreparedPayment; order: string; scope: string; mall: string; member: string; currency: string; amountMinor: number; snapshot: unknown }>): Promise<CheckoutPaymentResult>;
  continue(request: OperationRequest, input: Readonly<{ payment: PreparedPayment; order: string; scene: WechatScene }>): Promise<CheckoutPaymentResult>;
}
export interface OrderExpiryPaymentPort {
  expire(database: OperationDatabase, order: string | null): Promise<void>;
  expirations(database: OperationDatabase, order: string | null): Promise<readonly PaymentExpiration[]>;
}
export interface PaymentExpiration {
  readonly intent: string;
  readonly order: string;
  readonly external: boolean;
}
export interface PaymentHoldReleasePort {
  release(database: OperationDatabase, order: string): Promise<void>;
}
export interface FinancePaymentPort {
  externalAmount(database: OperationDatabase, kind: 'payment' | 'refund', reference: string): Promise<number>;
  reconciliation(database: OperationDatabase, references: readonly string[]): Promise<readonly FinancePaymentMatch[]>;
}
export interface FinancePaymentMatch {
  readonly reference: string;
  readonly kind: 'payment' | 'refund';
  readonly id: string;
  readonly amountMinor: number;
}
export const CHECKOUT_PAYMENT_PORT = publicPort<CheckoutPaymentPort>('payment', 'checkout');
export const FINANCE_PAYMENT_PORT = publicPort<FinancePaymentPort>('payment', 'finance');
