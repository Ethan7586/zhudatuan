import type { FinanceCommandResult } from '../model/Finance';
import type { RepairDraft } from '../model/FinanceGovernance';

export function repairPreviewBody(draft: RepairDraft) {
  return {
    statementId: draft.statementId.trim(),
    sourceJournalId: draft.sourceJournalId.trim(),
    sourceHash: draft.sourceHash,
    entries: draft.entries,
    reason: draft.reason.trim(),
    expectedVersion: draft.expectedVersion,
  };
}

export function commandResult(value: Readonly<{ id: string; state: string }>): FinanceCommandResult {
  return Object.freeze({ reference: value.id, state: value.state });
}
