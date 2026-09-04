import type { FinanceJobExecution, SettlementJobProcess } from '../port/FinanceJobProcess';

export class RunSettlement {
  constructor(private readonly process: SettlementJobProcess) {}

  settle(reconciliation: string, execution: FinanceJobExecution): Promise<void> {
    return this.process.settle(Object.freeze({ reconciliation, business: business('settlement', reconciliation) }), execution);
  }

  withdraw(withdrawal: string, execution: FinanceJobExecution): Promise<void> {
    return this.process.withdraw(Object.freeze({ withdrawal, business: business('payout', withdrawal) }), execution);
  }
}

function business(kind: 'settlement' | 'payout', source: string): string {
  if (!source.trim() || source.length > 256) throw new Error('FINANCE_BUSINESS_SOURCE_INVALID');
  return kind === 'settlement' ? `settlement:${source}` : source;
}
