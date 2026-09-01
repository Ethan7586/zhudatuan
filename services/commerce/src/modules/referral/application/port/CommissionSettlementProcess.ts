export interface CommissionSettlementProcess {
  settle(scopeId: string, orderId: string | null, signal: AbortSignal, deadline: number): Promise<void>;
}
