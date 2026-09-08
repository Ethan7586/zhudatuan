import { Money } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';
import { AccountingDate } from '../value/AccountingDate';

export type StatementState = 'draft' | 'final' | 'replaced';

export interface StatementValue {
  readonly id: string;
  readonly scopeId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: string;
  readonly openingMinor: number;
  readonly debitMinor: number;
  readonly creditMinor: number;
  readonly closingMinor: number;
  readonly state: StatementState;
  readonly objectRef: string | null;
  readonly sha256: string | null;
  readonly generatedAt: string;
  readonly version: number;
}

export class Statement {
  private constructor(private readonly value: StatementValue) {
    if (!value.id || !value.scopeId || !date(value.periodStart) || !date(value.periodEnd) || value.periodStart > value.periodEnd) {
      throw new DomainError('VALIDATION_FAILED', { field: 'statementPeriod' });
    }
    const opening = Money.of(value.openingMinor, value.currency as 'CNY');
    const debit = Money.of(value.debitMinor, value.currency as 'CNY');
    const credit = Money.of(value.creditMinor, value.currency as 'CNY');
    if (debit.minor < 0 || credit.minor < 0 || opening.add(debit).subtract(credit).minor !== value.closingMinor) {
      throw new DomainError('FINANCE_JOURNAL_UNBALANCED', { opening: value.openingMinor, debit: value.debitMinor, credit: value.creditMinor, closing: value.closingMinor });
    }
    if (!Number.isSafeInteger(value.version) || value.version < 0 || (value.sha256 !== null && !/^[a-f0-9]{64}$/.test(value.sha256))) {
      throw new DomainError('VALIDATION_FAILED', { field: 'statement' });
    }
    AccountingDate.of(value.generatedAt);
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static draft(value: Omit<StatementValue, 'state'>): Statement {
    return new Statement({ ...value, state: 'draft' });
  }

  static restore(value: StatementValue): Statement {
    return new Statement({ ...value });
  }

  finalize(): Statement {
    if (this.value.state !== 'draft') throw new DomainError('VERSION_CONFLICT');
    return new Statement({ ...this.value, state: 'final', version: this.value.version + 1 });
  }

  replace(): Statement {
    if (this.value.state !== 'final') throw new DomainError('VERSION_CONFLICT');
    return new Statement({ ...this.value, state: 'replaced', version: this.value.version + 1 });
  }

  snapshot(): StatementValue {
    return this.value;
  }
}

function date(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}
