import { Money } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';
import type { AccountingDate } from '../value/AccountingDate';
import type { PostingReference } from '../value/PostingReference';
import type { Account } from './Account';
import type { AccountingPeriod } from './AccountingPeriod';
import type { Journal } from './Journal';

export class Ledger {
  private constructor(
    readonly scopeId: string,
    readonly accounts: readonly Account[],
    readonly journals: readonly Journal[]
  ) {
    if (!scopeId || accounts.some((account) => account.snapshot().scopeId !== scopeId) || journals.some((journal) => journal.snapshot().scopeId !== scopeId)) {
      throw new DomainError('VALIDATION_FAILED', { field: 'ledgerScope' });
    }
    assertUnique(
      accounts.map((account) => account.snapshot().id),
      'account'
    );
    assertUnique(
      journals.map((journal) => journal.snapshot().id),
      'journal'
    );
    assertUnique(
      journals.map((journal) => referenceKey(journal)),
      'postingReference'
    );
    assertUnique(
      journals.map((journal) => legKey(journal)),
      'economicLeg'
    );
    Object.freeze(this.accounts);
    Object.freeze(this.journals);
    Object.freeze(this);
  }

  static empty(scopeId: string, accounts: readonly Account[]): Ledger {
    return new Ledger(scopeId, Object.freeze([...accounts]), Object.freeze([]));
  }

  static restore(scopeId: string, accounts: readonly Account[], journals: readonly Journal[]): Ledger {
    return new Ledger(scopeId, Object.freeze([...accounts]), Object.freeze([...journals]));
  }

  post(journal: Journal, period: AccountingPeriod, at: AccountingDate): Ledger {
    if (journal.snapshot().scopeId !== this.scopeId) throw new DomainError('VALIDATION_FAILED', { field: 'journalScope' });
    if (this.journals.some((current) => referenceKey(current) === referenceKey(journal) || legKey(current) === legKey(journal))) {
      throw new DomainError('IDEMPOTENCY_CONFLICT');
    }
    const posted = journal.post(period, at);
    return new Ledger(this.scopeId, this.accounts, Object.freeze([...this.journals, posted]));
  }

  reverse(journalId: string, id: string, reference: PostingReference, period: AccountingPeriod, at: AccountingDate): Ledger {
    const source = this.journals.find((journal) => journal.snapshot().id === journalId);
    if (!source) throw new DomainError('RESOURCE_NOT_FOUND');
    return this.post(source.reversal({ id, reference, at }), period, at);
  }

  balance(accountId: string): Money {
    const account = this.accounts.find((candidate) => candidate.snapshot().id === accountId);
    if (!account) throw new DomainError('RESOURCE_NOT_FOUND');
    const snapshot = account.snapshot();
    return this.journals.reduce((balance, journal) => {
      if (journal.snapshot().state !== 'posted') return balance;
      return journal.snapshot().entries.reduce((subtotal, entry) => {
        const value = entry.snapshot();
        if (value.accountId !== accountId) return subtotal;
        const debitNormal = snapshot.code.kind === 'asset' || snapshot.code.kind === 'expense';
        const positive = (value.side === 'debit') === debitNormal;
        return subtotal.add(Money.of(positive ? value.amount.minor : -value.amount.minor, snapshot.currency.code));
      }, balance);
    }, Money.zero(snapshot.currency.code));
  }
}

function referenceKey(journal: Journal): string {
  const reference = journal.snapshot().reference.value;
  return `${reference.module}:${reference.aggregate}:${reference.aggregateId}`;
}

function legKey(journal: Journal): string {
  const reference = journal.snapshot().reference.value;
  return `${reference.eventId}:${reference.leg}`;
}

function assertUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) throw new DomainError('VALIDATION_FAILED', { field });
}
