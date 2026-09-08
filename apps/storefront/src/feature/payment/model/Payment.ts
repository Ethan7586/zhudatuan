import type { PaymentAction } from './PaymentAction';
import type { OperationOutputFor } from '@shop/contract';

export type PaymentState = OperationOutputFor<'payment.intents.read'>['state'];

export interface Payment {
  readonly intentId: string;
  readonly orderId: string;
  readonly paymentId: string;
  readonly state: PaymentState;
  readonly action: PaymentAction | null;
  readonly expiresAt: string;
  readonly retryAfter: number;
}
