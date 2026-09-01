import type { FinanceEntryTemplate } from '../../domain/model/FinancePolicy';
import type { RepairDifference } from '../../domain/model/RepairCase';

export interface RepairView extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly version: number;
}

export interface RepairRepository {
  read(scopeIds: readonly string[], status: string | null, statementId: string | null, cursor: string | null, limit: number): Promise<readonly RepairView[]>;
  statement(scopeId: string, statementId: string): Promise<Readonly<{ id: string; hash: string; version: number; differences: readonly RepairDifference[] }> | null>;
  savePreview(
    input: Readonly<{
      tokenHash: string;
      scopeId: string;
      statementId: string;
      sourceHash: string;
      sourceVersion: number;
      previewHash: string;
      entries: readonly FinanceEntryTemplate[];
      differences: readonly RepairDifference[];
      makerId: string;
      reason: string;
      expiresAt: string;
    }>
  ): Promise<void>;
  submit(input: Readonly<{ id: string; tokenHash: string; scopeId: string; makerId: string; previewHash: string; sourceVersion: number; reason: string }>): Promise<RepairView | null>;
  decide(input: Readonly<{ id: string; scopeId: string; checkerId: string; decision: 'approved' | 'rejected'; expectedVersion: number; reason: string }>): Promise<RepairView | null>;
  reverse(input: Readonly<{ id: string; scopeId: string; checkerId: string; expectedVersion: number; reason: string }>): Promise<RepairView | null>;
}
