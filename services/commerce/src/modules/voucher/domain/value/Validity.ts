import { DomainError } from '../../../../foundation/domain/DomainError';

export class Validity {
  readonly startsAt: Date;
  readonly expiresAt: Date;
  constructor(startsAt: Date, expiresAt: Date) {
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= startsAt) throw new DomainError('VALIDATION_FAILED', { field: 'validity' });
    this.startsAt = startsAt;
    this.expiresAt = expiresAt;
  }
  active(now: Date): boolean { return this.startsAt <= now && now < this.expiresAt; }
}
