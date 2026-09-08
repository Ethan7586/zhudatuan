import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface SettlementCursor {
  readonly occurredAt: string | null;
  readonly entry: string | null;
}

export interface SettlementEntry {
  readonly id: string;
  readonly accountId: string;
  readonly amountMinor: number;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly description: string;
  readonly occurredAt: Date | string;
}

export interface SettlementReadPort {
  entries(context: ReadTransactionContext, accountIds: readonly string[], after: SettlementCursor, limit: number): Promise<readonly SettlementEntry[]>;
}
