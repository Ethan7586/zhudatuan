import { DomainError } from '../../../../platform/error/DomainError';

export interface ChallengeValue {
  readonly session: string;
  readonly tokenHash: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

export class Challenge {
  private constructor(private readonly value: ChallengeValue) {
    if (!value.session || !/^[a-f0-9]{64}$/.test(value.tokenHash) || value.expiresAt <= value.issuedAt || (value.consumedAt !== null && value.consumedAt < value.issuedAt)) {
      throw new DomainError('VALIDATION_FAILED');
    }
  }

  static issue(value: Omit<ChallengeValue, 'consumedAt'>): Challenge {
    return new Challenge(Object.freeze({ ...value, consumedAt: null }));
  }

  static restore(value: ChallengeValue): Challenge {
    return new Challenge(Object.freeze({ ...value }));
  }

  consume(now: Date): Challenge {
    if (this.value.consumedAt !== null || this.value.expiresAt <= now) throw new DomainError('VERIFICATION_TOKEN_INVALID');
    return new Challenge(Object.freeze({ ...this.value, consumedAt: now }));
  }

  snapshot(): ChallengeValue {
    return this.value;
  }
}
