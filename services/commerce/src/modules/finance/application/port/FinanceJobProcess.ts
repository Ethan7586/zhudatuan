export interface FinanceJobExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export interface InvoiceJobProcess {
  issue(input: Readonly<{ request: string; business: string }>, execution: FinanceJobExecution): Promise<void>;
}

export interface SettlementJobProcess {
  settle(input: Readonly<{ reconciliation: string; business: string }>, execution: FinanceJobExecution): Promise<void>;
  withdraw(input: Readonly<{ withdrawal: string; business: string }>, execution: FinanceJobExecution): Promise<void>;
}
