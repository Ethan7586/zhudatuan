import type { PaymentAction } from './PaymentAction';

export type PaymentState = 'captured' | 'pending' | 'preparing' | 'recovery' | 'failed' | 'expired';

export interface Payment {
  readonly intentId: string;
  readonly orderId: string;
  readonly paymentId: string;
  readonly state: PaymentState;
  readonly action: PaymentAction | null;
  readonly expiresAt: string;
  readonly retryAfter: number | null;
}
