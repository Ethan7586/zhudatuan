export type SettlementOutcome = 'skipped' | 'failed' | 'succeeded';
export interface SettlementReceipt {
  readonly source: 'commission' | 'withdrawal';
  readonly id: string;
  readonly outcome: SettlementOutcome;
  readonly reference: string | null;
  readonly error: string | null;
}
export interface SettlementBatchReceipt {
  readonly scopeId: string;
  readonly items: readonly SettlementReceipt[];
}
export interface CommissionSettlementProcess {
  settle(scopeId: string, orderId: string | null, signal: AbortSignal, deadline: number): Promise<SettlementBatchReceipt>;
}
