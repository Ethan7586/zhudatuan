import { DomainError } from '../../../../foundation/domain/DomainError';
export type PaymentAttemptScene = 'miniapp' | 'jsapi';

export type PaymentAttemptState = 'started' | 'pending' | 'succeeded' | 'failed' | 'unknown';

export interface PaymentAttemptValue {
  readonly id: string;
  readonly intent: string;
  readonly provider: string;
  readonly scene: PaymentAttemptScene;
  readonly applicationHash: string;
  readonly state: PaymentAttemptState;
  readonly externalTransaction: string | null;
  readonly requestedAt: Date;
  readonly completedAt: Date | null;
}

export class PaymentAttempt {
  constructor(readonly value: PaymentAttemptValue) {
    if (!value.id || !value.intent || !value.provider || !/^[a-f0-9]{64}$/.test(value.applicationHash)) throw new DomainError('VALIDATION_FAILED');
    if (value.state === 'succeeded' && (!value.externalTransaction || value.completedAt === null)) throw new DomainError('PAYMENT_INTENT_CONFLICT');
    if (value.state === 'started' && value.completedAt !== null) throw new DomainError('PAYMENT_INTENT_CONFLICT');
  }
}
