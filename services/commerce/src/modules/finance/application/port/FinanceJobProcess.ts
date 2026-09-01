export interface FinanceJobExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export interface InvoiceJobProcess {
  issue(request: string, execution: FinanceJobExecution): Promise<void>;
}

export interface SettlementJobProcess {
  settle(reconciliation: string, execution: FinanceJobExecution): Promise<void>;
  withdraw(withdrawal: string, execution: FinanceJobExecution): Promise<void>;
}
