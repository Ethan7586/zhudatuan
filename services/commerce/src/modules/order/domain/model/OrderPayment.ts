import { DomainError } from '../../../../platform/error/DomainError';
import type { PaymentState } from './Order';

export interface OrderPaymentSnapshot {
  readonly state: PaymentState;
  readonly currency: string;
  readonly payableMinor: number;
  readonly capturedMinor: number;
  readonly refundedMinor: number;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export class OrderPayment {
  private constructor(readonly value: OrderPaymentSnapshot) {}

  static freeze(value: OrderPaymentSnapshot): OrderPayment {
    if (!/^[A-Z]{3}$/.test(value.currency) || ![value.payableMinor, value.capturedMinor, value.refundedMinor].every(Number.isSafeInteger)) invalid();
    if (value.payableMinor < 0 || value.capturedMinor < 0 || value.refundedMinor < 0 || value.refundedMinor > value.capturedMinor || value.capturedMinor > value.payableMinor) invalid();
    if (value.state === 'unpaid' && value.capturedMinor !== 0) invalid();
    if (value.state === 'refunded' && value.refundedMinor !== value.capturedMinor) invalid();
    return new OrderPayment(Object.freeze({ ...value, evidence: Object.freeze({ ...value.evidence }) }));
  }
}

function invalid(): never {
  throw new DomainError('ORDER_SNAPSHOT_INVALID');
}
