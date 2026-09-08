import type { Money } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';
import type { AccountCode } from '../value/AccountCode';

export interface Posting {
  readonly account: AccountCode;
  readonly side: 'debit' | 'credit';
  readonly amount: Money;
}

export class PostingPolicy {
  assertBalanced(entries: readonly Posting[]): void {
    if (entries.length < 2 || entries.length > 1_000) throw new DomainError('FINANCE_JOURNAL_UNBALANCED', { entries: entries.length });
    const currencies = new Set(entries.map((entry) => entry.amount.currency.code));
    if (currencies.size !== 1 || entries.some((entry) => entry.amount.minor <= 0)) {
      throw new DomainError('FINANCE_JOURNAL_UNBALANCED', { currencies: [...currencies], positive: false });
    }
    const debitAccounts = new Set(entries.filter((entry) => entry.side === 'debit').map((entry) => entry.account.value));
    const creditAccounts = new Set(entries.filter((entry) => entry.side === 'credit').map((entry) => entry.account.value));
    if ([...debitAccounts].some((account) => creditAccounts.has(account))) {
      throw new DomainError('FINANCE_JOURNAL_UNBALANCED', { sameAccount: true });
    }
    const debit = entries.filter((entry) => entry.side === 'debit').reduce((sum, entry) => sum + BigInt(entry.amount.minor), 0n);
    const credit = entries.filter((entry) => entry.side === 'credit').reduce((sum, entry) => sum + BigInt(entry.amount.minor), 0n);
    if (debit <= 0n || debit !== credit || debit > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new DomainError('FINANCE_JOURNAL_UNBALANCED', { debit: debit.toString(), credit: credit.toString() });
    }
  }

  reverse(entries: readonly Posting[]): readonly Posting[] {
    this.assertBalanced(entries);
    return Object.freeze(entries.map((entry) => Object.freeze({ ...entry, side: entry.side === 'debit' ? ('credit' as const) : ('debit' as const) })));
  }
}
