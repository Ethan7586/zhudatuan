import { DomainError } from '../../../../platform/error/DomainError';

export type RefundState = 'requested' | 'submitted' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface RefundValue {
  readonly id: string;
  readonly payment: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly state: RefundState;
  readonly reason: string;
  readonly version: number;
}

const transitions: Readonly<Record<RefundState, readonly RefundState[]>> = Object.freeze({
  requested: Object.freeze<RefundState[]>(['submitted', 'processing', 'succeeded', 'failed', 'cancelled']),
  submitted: Object.freeze<RefundState[]>(['processing', 'succeeded', 'failed']),
  processing: Object.freeze<RefundState[]>(['succeeded', 'failed']),
  succeeded: Object.freeze([]),
  failed: Object.freeze([]),
  cancelled: Object.freeze([]),
});

export class Refund {
  constructor(readonly value: RefundValue) {
    if (!value.id || !value.payment || !value.reason.trim() || value.currency !== 'CNY' || !Number.isSafeInteger(value.amountMinor) || value.amountMinor <= 0) throw new DomainError('VALIDATION_FAILED');
    if (!Number.isSafeInteger(value.version) || value.version < 0) throw new DomainError('VALIDATION_FAILED');
  }

  transition(next: RefundState): Refund {
    if (next === this.value.state) return this;
    if (!transitions[this.value.state].includes(next)) throw new DomainError('PAYMENT_INTENT_CONFLICT');
    return new Refund(Object.freeze({ ...this.value, state: next, version: this.value.version + 1 }));
  }

  retry(): Refund {
    if (this.value.state !== 'failed') throw new DomainError('PAYMENT_INTENT_CONFLICT');
    return new Refund(Object.freeze({ ...this.value, state: 'requested', version: this.value.version + 1 }));
  }
}
