import type { FinanceJobExecution, SettlementJobProcess } from '../port/FinanceJobProcess';

export class RunSettlement {
  constructor(private readonly process: SettlementJobProcess) {}

  settle(reconciliation: string, execution: FinanceJobExecution): Promise<void> {
    return this.process.settle(reconciliation, execution);
  }

  withdraw(withdrawal: string, execution: FinanceJobExecution): Promise<void> {
    return this.process.withdraw(withdrawal, execution);
  }
}
