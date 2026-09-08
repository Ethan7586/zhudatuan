import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';

export type { PaymentScene } from '@shop/contract';
import type { PaymentScene } from '@shop/contract';

export interface PaymentTenderPlan {
  readonly kind: 'wechat' | 'benefit' | 'voucher';
  readonly reference: string | null;
  readonly amountMinor: number;
}

export interface PaymentIntentCommand {
  readonly order: string;
  readonly orderNumber: string;
  readonly scope: string;
  readonly mall: string;
  readonly member: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly idempotency: string;
  readonly tenders: readonly PaymentTenderPlan[];
}

export interface PaymentIntentReceipt {
  readonly intent: string;
  readonly external: boolean;
  readonly expiresAt: string;
}

export interface PaymentRefundCommand {
  readonly payment: string;
  readonly amountMinor: number;
  readonly reason: string;
  readonly idempotency: string;
  readonly expectedVersion: number;
}

export interface PaymentPort {
  prepare(context: WriteTransactionContext, input: PaymentIntentCommand): Promise<PaymentIntentReceipt>;
  externalAmount(context: ReadTransactionContext, kind: 'payment' | 'refund', reference: string): Promise<number>;
}
