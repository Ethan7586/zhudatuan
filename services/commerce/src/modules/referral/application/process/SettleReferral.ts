import type { CommissionSettlementProcess } from '../port/CommissionSettlementProcess';

export class SettleReferral {
  constructor(private readonly settlements: CommissionSettlementProcess) {}

  execute(scopeId: string, orderId: string | null, signal: AbortSignal, deadline: number): Promise<void> {
    return this.settlements.settle(scopeId, orderId, signal, deadline);
  }
}
