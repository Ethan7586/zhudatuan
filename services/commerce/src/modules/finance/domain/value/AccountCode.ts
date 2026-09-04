import { DomainError } from '../../../../foundation/domain/DomainError';

export type AccountKind = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export class AccountCode {
  private constructor(
    readonly value: string,
    readonly kind: AccountKind
  ) {
    Object.freeze(this);
  }

  static of(value: string, kind: AccountKind): AccountCode {
    const code = value.trim();
    if (code.length === 0 || code.length > 192 || !/^[a-z][a-z0-9]*(?:[.:][a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(code)) {
      throw new DomainError('VALIDATION_FAILED', { field: 'accountCode' });
    }
    if (!['asset', 'liability', 'equity', 'income', 'expense'].includes(kind)) {
      throw new DomainError('VALIDATION_FAILED', { field: 'accountKind' });
    }
    return new AccountCode(code, kind);
  }

  equals(other: AccountCode): boolean {
    return this.value === other.value && this.kind === other.kind;
  }
}
