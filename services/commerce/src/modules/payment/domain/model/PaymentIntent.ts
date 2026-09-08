import { DomainError } from '../../../../platform/error/DomainError';

export type PaymentIntentState = 'created' | 'preparing' | 'pending' | 'captured' | 'partiallyrefunded' | 'refunded' | 'failed' | 'cancelled' | 'expired';

export interface PaymentIntentValue {
  readonly id: string;
  readonly order: string;
  readonly scope: string;
  readonly mall: string;
  readonly member: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly state: PaymentIntentState;
  readonly idempotency: string;
  readonly providerReference: string;
  readonly expiresAt: Date;
  readonly version: number;
}

const transitions: Readonly<Record<PaymentIntentState, readonly PaymentIntentState[]>> = Object.freeze({
  created: Object.freeze<PaymentIntentState[]>(['preparing', 'captured', 'failed', 'cancelled', 'expired']),
  preparing: Object.freeze<PaymentIntentState[]>(['pending', 'captured', 'failed', 'cancelled', 'expired']),
  pending: Object.freeze<PaymentIntentState[]>(['captured', 'failed', 'cancelled', 'expired']),
  captured: Object.freeze<PaymentIntentState[]>(['partiallyrefunded', 'refunded']),
  partiallyrefunded: Object.freeze<PaymentIntentState[]>(['partiallyrefunded', 'refunded']),
  refunded: Object.freeze([]),
  failed: Object.freeze([]),
  cancelled: Object.freeze([]),
  expired: Object.freeze([]),
});

export class PaymentIntent {
  private constructor(private readonly value: PaymentIntentValue) {
    this.assert();
  }

  static create(value: Omit<PaymentIntentValue, 'state' | 'version'>): PaymentIntent {
    return new PaymentIntent(Object.freeze({ ...value, state: 'created', version: 0 }));
  }

  static restore(value: PaymentIntentValue): PaymentIntent {
    return new PaymentIntent(Object.freeze({ ...value }));
  }

  transition(next: PaymentIntentState, now: Date): PaymentIntent {
    if (next === this.value.state) return this;
    if (!transitions[this.value.state].includes(next)) throw new DomainError('PAYMENT_INTENT_CONFLICT');
    if (now.getTime() >= this.value.expiresAt.getTime() && !['captured', 'expired'].includes(next)) throw new DomainError('PAYMENT_INTENT_NOT_PAYABLE');
    return new PaymentIntent(Object.freeze({ ...this.value, state: next, version: this.value.version + 1 }));
  }

  retry(idempotency: string, expiresAt: Date, now: Date): PaymentIntent {
    if (this.value.state !== 'failed') throw new DomainError('PAYMENT_INTENT_CONFLICT');
    if (!idempotency || expiresAt.getTime() <= now.getTime()) throw new DomainError('PAYMENT_INTENT_NOT_PAYABLE');
    return new PaymentIntent(
      Object.freeze({
        ...this.value,
        state: 'preparing',
        idempotency,
        expiresAt,
        version: this.value.version + 1,
      })
    );
  }

  snapshot(): PaymentIntentValue {
    return this.value;
  }

  private assert(): void {
    if (!this.value.id || !this.value.order || !this.value.scope || !this.value.member || !this.value.idempotency || !this.value.providerReference) throw new DomainError('VALIDATION_FAILED');
    if (!Number.isSafeInteger(this.value.amountMinor) || this.value.amountMinor < 0 || this.value.currency !== 'CNY') throw new DomainError('VALIDATION_FAILED');
    if (!Number.isSafeInteger(this.value.version) || this.value.version < 0 || !Number.isFinite(this.value.expiresAt.getTime())) throw new DomainError('VALIDATION_FAILED');
  }
}
