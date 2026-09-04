import { DomainError } from '../../../../foundation/domain/DomainError';

export class AccountingDate {
  private constructor(private readonly date: Date) {
    Object.freeze(this);
  }

  static of(value: string | Date): AccountingDate {
    if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
      throw new DomainError('VALIDATION_FAILED', { field: 'accountingDate' });
    }
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new DomainError('VALIDATION_FAILED', { field: 'accountingDate' });
    return new AccountingDate(date);
  }

  static firstOf(period: string): AccountingDate {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new DomainError('VALIDATION_FAILED', { field: 'period' });
    return AccountingDate.of(`${period}-01T00:00:00.000Z`);
  }

  get instant(): string {
    return this.date.toISOString();
  }

  get period(): string {
    return this.instant.slice(0, 7);
  }

  compare(other: AccountingDate): number {
    return this.date.getTime() - other.date.getTime();
  }
}
