import type { RepairDifference } from '../../domain/model/RepairCase';
import type { RepairProposal } from '../../domain/model/RepairProposal';

export interface RepairView extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly version: number;
}

export interface RepairDecisionContext {
  readonly id: string;
  readonly scopeId: string;
  readonly status: string;
  readonly makerId: string;
  readonly version: number;
  readonly statementId: string;
  readonly sourceHash: string;
  readonly sourceVersion: number;
  readonly sourceJournalId: string;
  readonly sourceJournalHash: string;
  readonly previewHash: string;
  readonly approvalInstanceId: string;
  readonly approvalAmountMinor: number;
  readonly sourceReversalJournalId: string | null;
  readonly replacementJournalId: string | null;
  readonly rollbackJournalId: string | null;
}

export interface RepairRepository {
  read(scopeIds: readonly string[], status: string | null, statementId: string | null, cursor: string | null, limit: number): Promise<readonly RepairView[]>;
  statement(scopeId: string, statementId: string): Promise<Readonly<{ id: string; hash: string; version: number; currency: string; periodStart: string; periodEnd: string; differences: readonly RepairDifference[] }> | null>;
  sourceJournal(scopeId: string, journalId: string, periodStart: string, periodEnd: string, currency: string): Promise<Readonly<{ id: string; hash: string; debitMinor: number }> | null>;
  submit(input: Readonly<{ id: string; previewHash: string; approvalInstanceId: string; approvalAmountMinor: number; proposal: RepairProposal }>): Promise<RepairView | null>;
  lock(id: string, scopeId: string): Promise<RepairDecisionContext>;
  decide(input: Readonly<{ id: string; scopeId: string; checkerId: string; proofId: string | null; decision: 'approved' | 'rejected'; expectedVersion: number; reason: string }>): Promise<RepairView | null>;
  reverse(input: Readonly<{ id: string; scopeId: string; checkerId: string; expectedVersion: number; reason: string }>): Promise<RepairView | null>;
}
