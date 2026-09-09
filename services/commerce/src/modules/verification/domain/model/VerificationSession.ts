import { DomainError } from '../../../../platform/error/DomainError';

export type VerificationPurpose = 'member_code' | 'voucher_redeem' | 'login' | 'sensitive_action' | 'financial_approval';
export type VerificationChannel = 'qrcode' | 'sms' | 'app';
export type VerificationSessionState = 'issued' | 'verified' | 'expired' | 'revoked' | 'locked';

export interface VerificationSessionValue {
  readonly id: string;
  readonly scope: string;
  readonly subjectType: 'member' | 'voucher' | 'principal' | 'resource';
  readonly subject: string;
  readonly purpose: VerificationPurpose;
  readonly operation: string;
  readonly channel: VerificationChannel;
  readonly state: VerificationSessionState;
  readonly attempts: number;
  readonly maximumAttempts: number;
  readonly issuedBy: string;
  readonly issuedAccessVersion: number;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly verifiedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly revokeReason: 'member_action' | 'refreshed' | 'authorization_changed' | 'migration' | null;
  readonly version: number;
}

export class VerificationSession {
  private constructor(private readonly value: VerificationSessionValue) {
    validate(value);
  }

  static issue(input: Omit<VerificationSessionValue, 'state' | 'attempts' | 'verifiedAt' | 'revokedAt' | 'revokeReason' | 'version'>): VerificationSession {
    return new VerificationSession(freeze({ ...input, state: 'issued', attempts: 0, verifiedAt: null, revokedAt: null, revokeReason: null, version: 0 }));
  }

  static restore(value: VerificationSessionValue): VerificationSession {
    return new VerificationSession(freeze(value));
  }

  reject(now: Date): VerificationSession {
    const current = this.open(now);
    const attempts = current.value.attempts + 1;
    return current.with({ attempts, state: attempts >= current.value.maximumAttempts ? 'locked' : 'issued' });
  }

  verify(now: Date): VerificationSession {
    const current = this.open(now);
    return current.with({ state: 'verified', attempts: current.value.attempts + 1, verifiedAt: now });
  }

  revoke(now: Date, reason: Exclude<VerificationSessionValue['revokeReason'], null>): VerificationSession {
    if (this.value.state === 'revoked' || this.value.state === 'expired') return this;
    if (this.value.state !== 'issued') throw new DomainError('VERIFICATION_TOKEN_INVALID');
    if (this.value.expiresAt.getTime() <= now.getTime()) return this.with({ state: 'expired' });
    return this.with({ state: 'revoked', revokedAt: now, revokeReason: reason });
  }

  snapshot(): VerificationSessionValue {
    return this.value;
  }

  private open(now: Date): VerificationSession {
    if (this.value.expiresAt.getTime() <= now.getTime()) throw new DomainError('VERIFICATION_TOKEN_INVALID');
    if (this.value.state !== 'issued' || this.value.attempts >= this.value.maximumAttempts) throw new DomainError('VERIFICATION_TOKEN_INVALID');
    return this;
  }

  private with(change: Partial<VerificationSessionValue>): VerificationSession {
    return new VerificationSession(freeze({ ...this.value, ...change, version: this.value.version + 1 }));
  }
}

function validate(value: VerificationSessionValue): void {
  if (!value.id || !value.scope || !value.subject || !value.operation || !value.issuedBy) invalid();
  if (!['member', 'voucher', 'principal', 'resource'].includes(value.subjectType)) invalid();
  if (!['member_code', 'voucher_redeem', 'login', 'sensitive_action', 'financial_approval'].includes(value.purpose)) invalid();
  if (!['qrcode', 'sms', 'app'].includes(value.channel) || !['issued', 'verified', 'expired', 'revoked', 'locked'].includes(value.state)) invalid();
  if (!Number.isSafeInteger(value.attempts) || value.attempts < 0 || !Number.isSafeInteger(value.maximumAttempts) || value.maximumAttempts < 1 || value.attempts > value.maximumAttempts) invalid();
  if (!Number.isSafeInteger(value.issuedAccessVersion) || value.issuedAccessVersion < 0) invalid();
  if (!Number.isSafeInteger(value.version) || value.version < 0 || value.expiresAt <= value.createdAt) invalid();
  if ((value.state === 'verified') !== (value.verifiedAt !== null)) invalid();
  if ((value.state === 'revoked') !== (value.revokedAt !== null && value.revokeReason !== null)) invalid();
}

function freeze(value: VerificationSessionValue): VerificationSessionValue {
  return Object.freeze({
    ...value,
    createdAt: new Date(value.createdAt),
    expiresAt: new Date(value.expiresAt),
    verifiedAt: value.verifiedAt === null ? null : new Date(value.verifiedAt),
    revokedAt: value.revokedAt === null ? null : new Date(value.revokedAt),
  });
}

function invalid(): never {
  throw new DomainError('VALIDATION_FAILED');
}
