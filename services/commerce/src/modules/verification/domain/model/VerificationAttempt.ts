import { DomainError } from '../../../../foundation/domain/DomainError';
import type { VerificationPurpose } from './VerificationSession';

export type VerificationAttemptResult = 'accepted' | 'rejected' | 'replayed' | 'expired';

export class VerificationAttempt {
  readonly value: Readonly<{
    id: string; session: string; sequence: number; scope: string; purpose: VerificationPurpose; operation: string;
    actor: string; device: string | null; result: VerificationAttemptResult; reason: string; trace: string; attemptedAt: Date;
  }>;

  constructor(value: VerificationAttempt['value']) {
    if (!value.id || !value.session || !value.scope || !value.operation || !value.actor || !value.reason || !value.trace || !Number.isSafeInteger(value.sequence) || value.sequence < 1) {
      throw new DomainError('VALIDATION_FAILED');
    }
    if (!['accepted', 'rejected', 'replayed', 'expired'].includes(value.result)) throw new DomainError('VALIDATION_FAILED');
    this.value = Object.freeze({ ...value, attemptedAt: new Date(value.attemptedAt) });
  }
}
