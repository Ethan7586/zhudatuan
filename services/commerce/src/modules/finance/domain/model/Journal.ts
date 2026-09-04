import { DomainError } from '../../../../foundation/domain/DomainError';
import { PostingPolicy } from '../policy/PostingPolicy';
import { AccountingDate } from '../value/AccountingDate';
import type { PostingReference } from '../value/PostingReference';
import { AccountCode } from '../value/AccountCode';
import type { AccountingPeriod } from './AccountingPeriod';
import type { JournalEntry } from './JournalEntry';

export type JournalState = 'draft' | 'posted' | 'reversed';

export interface JournalValue {
  readonly id: string;
  readonly scopeId: string;
  readonly reference: PostingReference;
  readonly description: string;
  readonly state: JournalState;
  readonly entries: readonly JournalEntry[];
  readonly postedAt: AccountingDate | null;
  readonly version: number;
}

export class Journal {
  private constructor(private readonly value: JournalValue) {
    if (!value.id || !value.scopeId || !value.description.trim() || value.description.length > 500 || !Number.isSafeInteger(value.version) || value.version < 0) {
      throw new DomainError('VALIDATION_FAILED', { field: 'journal' });
    }
    if ((value.state === 'draft') === (value.postedAt !== null)) throw new DomainError('VALIDATION_FAILED', { field: 'postedAt' });
    Object.freeze(this.value.entries);
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static draft(input: Readonly<{ id: string; scopeId: string; reference: PostingReference; description: string; entries: readonly JournalEntry[] }>): Journal {
    return new Journal({ ...input, description: input.description.trim(), entries: Object.freeze([...input.entries]), state: 'draft', postedAt: null, version: 0 });
  }

  static restore(value: JournalValue): Journal {
    return new Journal({ ...value, entries: Object.freeze([...value.entries]) });
  }

  post(period: AccountingPeriod, at: AccountingDate, policy = new PostingPolicy()): Journal {
    if (this.value.state !== 'draft') throw new DomainError('VERSION_CONFLICT');
    period.assertPostable(at);
    policy.assertBalanced(this.value.entries.map((entry) => {
      const value = entry.snapshot();
      return { account: AccountCode.of(value.accountCode, value.accountKind), side: value.side, amount: value.amount };
    }));
    return new Journal({ ...this.value, state: 'posted', postedAt: at, version: this.value.version + 1 });
  }

  reversal(input: Readonly<{ id: string; reference: PostingReference; at: AccountingDate }>): Journal {
    if (this.value.state !== 'posted') throw new DomainError('VERSION_CONFLICT');
    return Journal.draft({
      id: input.id,
      scopeId: this.value.scopeId,
      reference: input.reference,
      description: `冲正：${this.value.description}`,
      entries: this.value.entries.map((entry, index) => entry.reverse(`${input.id}:${index + 1}`, input.at)),
    });
  }

  snapshot(): JournalValue {
    return this.value;
  }
}
