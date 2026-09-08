import type { FinanceEntryTemplate } from './FinancePolicy';
import type { RepairDifference } from './RepairCase';
import { DomainError } from '../../../../platform/error/DomainError';

/** Complete, signed and immutable input to a finance repair. */
export interface RepairProposal {
  readonly scopeId: string;
  readonly statementId: string;
  readonly sourceHash: string;
  readonly sourceVersion: number;
  readonly sourceJournalId: string;
  readonly sourceJournalHash: string;
  readonly sourceJournalDebitMinor: number;
  readonly entries: readonly FinanceEntryTemplate[];
  readonly differences: readonly RepairDifference[];
  readonly makerId: string;
  readonly reason: string;
}

export function repairAmount(proposal: RepairProposal): number {
  const replacement = proposal.entries.reduce((sum, entry) => sum + BigInt(entry.debitMinor), 0n);
  const amount = replacement > BigInt(proposal.sourceJournalDebitMinor) ? replacement : BigInt(proposal.sourceJournalDebitMinor);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new DomainError('VALIDATION_FAILED', { field: 'repairAmount' });
  return Number(amount);
}
