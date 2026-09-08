import { DomainError } from '../../../../platform/error/DomainError';
import { RefundPolicy } from '../policy/RefundPolicy';

export interface RedemptionValue {
  readonly id: string;
  readonly voucher: string;
  readonly hold: string | null;
  readonly verification: string;
  readonly amountMinor: number;
  readonly refundedMinor: number;
  readonly state: 'succeeded' | 'partiallyrefunded' | 'refunded';
  readonly version: number;
}
export class Redemption {
  constructor(readonly value: RedemptionValue) {
    if (!Number.isSafeInteger(value.amountMinor) || !Number.isSafeInteger(value.refundedMinor) || value.amountMinor <= 0 || value.refundedMinor < 0 || value.refundedMinor > value.amountMinor)
      throw new DomainError('VOUCHER_REDEMPTION_CONFLICT');
  }
  refund(amount: number): Redemption {
    new RefundPolicy().validate(this.value.amountMinor, this.value.refundedMinor, amount);
    const refundedMinor = this.value.refundedMinor + amount;
    return new Redemption(Object.freeze({ ...this.value, refundedMinor, state: refundedMinor === this.value.amountMinor ? 'refunded' : 'partiallyrefunded', version: this.value.version + 1 }));
  }
}
