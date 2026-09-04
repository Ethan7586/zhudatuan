import type { Money } from '@shop/kernel';
import { DomainError } from '../../../../foundation/domain/DomainError';

export interface Posting { readonly side: 'debit' | 'credit'; readonly amount: Money }

export class PostingPolicy {
  assertBalanced(entries: readonly Posting[]): void {
    const debit = entries.filter((entry) => entry.side === 'debit').reduce((sum, entry) => sum + entry.amount.minor, 0);
    const credit = entries.filter((entry) => entry.side === 'credit').reduce((sum, entry) => sum + entry.amount.minor, 0);
    if (!Number.isSafeInteger(debit) || debit !== credit) throw new DomainError('FINANCE_JOURNAL_UNBALANCED', { debit, credit });
  }
}
