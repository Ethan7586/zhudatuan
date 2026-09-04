import { Money } from '@shop/kernel';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { Account } from './Account';
import { AccountingDate } from '../value/AccountingDate';
import type { AccountKind } from '../value/AccountCode';

export type EntrySide = 'debit' | 'credit';

export interface JournalEntryValue {
  readonly id: string;
  readonly accountId: string;
  readonly accountCode: string;
  readonly accountKind: AccountKind;
  readonly side: EntrySide;
  readonly amount: Money;
  readonly createdAt: AccountingDate;
}

export class JournalEntry {
  private constructor(private readonly value: JournalEntryValue) {
    if (!value.id || !value.accountId || value.amount.minor <= 0) throw new DomainError('VALIDATION_FAILED', { field: 'entry' });
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static create(id: string, account: Account, side: EntrySide, amount: Money, createdAt: AccountingDate): JournalEntry {
    const snapshot = account.snapshot();
    account.assertPostable();
    if (!snapshot.currency.equals(amount.currency)) throw new DomainError('VALIDATION_FAILED', { field: 'currency' });
    return new JournalEntry({ id, accountId: snapshot.id, accountCode: snapshot.code.value, accountKind: snapshot.code.kind, side, amount, createdAt });
  }

  static restore(input: Readonly<Omit<JournalEntryValue, 'amount' | 'createdAt'> & { amountMinor: number; currency: string; createdAt: string }>): JournalEntry {
    return new JournalEntry({ id: input.id, accountId: input.accountId, accountCode: input.accountCode, accountKind: input.accountKind, side: input.side,
      amount: Money.of(input.amountMinor, input.currency as 'CNY'), createdAt: AccountingDate.of(input.createdAt) });
  }

  reverse(id: string, createdAt: AccountingDate): JournalEntry {
    return new JournalEntry({ ...this.value, id, side: this.value.side === 'debit' ? 'credit' : 'debit', createdAt });
  }

  snapshot(): JournalEntryValue {
    return this.value;
  }
}
