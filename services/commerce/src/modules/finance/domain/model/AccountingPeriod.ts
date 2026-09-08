import { DomainError } from '../../../../platform/error/DomainError';
import type { AccountingDate } from '../value/AccountingDate';

export type AccountingPeriodState = 'open' | 'closing' | 'closed' | 'reopening';

export interface AccountingPeriodValue {
  readonly scopeId: string;
  readonly period: string;
  readonly state: AccountingPeriodState;
  readonly requestedBy: string | null;
  readonly closedAt: string | null;
  readonly closedBy: string | null;
  readonly version: number;
}

export class AccountingPeriod {
  private constructor(private readonly value: AccountingPeriodValue) {
    if (!value.scopeId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.period) || !Number.isSafeInteger(value.version) || value.version < 0) {
      throw new DomainError('VALIDATION_FAILED', { field: 'period' });
    }
    if ((value.state === 'closing' || value.state === 'reopening') && !value.requestedBy) {
      throw new DomainError('VALIDATION_FAILED', { field: 'requestedBy' });
    }
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static open(scopeId: string, period: string): AccountingPeriod {
    return new AccountingPeriod({ scopeId, period, state: 'open', requestedBy: null, closedAt: null, closedBy: null, version: 0 });
  }

  static restore(value: AccountingPeriodValue): AccountingPeriod {
    return new AccountingPeriod({ ...value });
  }

  requestClose(makerId: string): AccountingPeriod {
    if (this.value.state !== 'open' || !makerId) throw new DomainError('VERSION_CONFLICT');
    return new AccountingPeriod({ ...this.value, state: 'closing', requestedBy: makerId, version: this.value.version + 1 });
  }

  decideClose(checkerId: string, approved: boolean, occurredAt: AccountingDate): AccountingPeriod {
    if (this.value.state !== 'closing') throw new DomainError('VERSION_CONFLICT');
    assertSeparation(this.value.requestedBy, checkerId);
    return approved
      ? new AccountingPeriod({ ...this.value, state: 'closed', requestedBy: null, closedAt: occurredAt.instant, closedBy: checkerId, version: this.value.version + 1 })
      : new AccountingPeriod({ ...this.value, state: 'open', requestedBy: null, version: this.value.version + 1 });
  }

  requestReopen(makerId: string): AccountingPeriod {
    if (this.value.state !== 'closed' || !makerId) throw new DomainError('VERSION_CONFLICT');
    return new AccountingPeriod({ ...this.value, state: 'reopening', requestedBy: makerId, version: this.value.version + 1 });
  }

  decideReopen(checkerId: string, approved: boolean): AccountingPeriod {
    if (this.value.state !== 'reopening') throw new DomainError('VERSION_CONFLICT');
    assertSeparation(this.value.requestedBy, checkerId);
    return approved
      ? new AccountingPeriod({ ...this.value, state: 'open', requestedBy: null, closedAt: null, closedBy: null, version: this.value.version + 1 })
      : new AccountingPeriod({ ...this.value, state: 'closed', requestedBy: null, version: this.value.version + 1 });
  }

  assertPostable(date: AccountingDate): void {
    if (date.period !== this.value.period || this.value.state !== 'open') {
      throw new DomainError('VALIDATION_FAILED', { field: 'accountingPeriod', period: this.value.period, state: this.value.state });
    }
  }

  snapshot(): AccountingPeriodValue {
    return this.value;
  }
}

function assertSeparation(makerId: string | null, checkerId: string): void {
  if (!makerId || !checkerId || makerId === checkerId) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
}
