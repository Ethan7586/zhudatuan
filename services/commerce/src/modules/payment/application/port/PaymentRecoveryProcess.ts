export interface PaymentRecoveryExecution {
  readonly signal: AbortSignal;
  readonly deadline: number;
  readonly scope: string;
  readonly trace: string;
}

export interface PaymentRecoveryProcess {
  query(intent: string, execution: PaymentRecoveryExecution): Promise<void>;
  createRefund(aftersale: string, execution: PaymentRecoveryExecution): Promise<string>;
  refund(refund: string, worker: string, execution: PaymentRecoveryExecution): Promise<void>;
  completeEvent(event: string, execution: PaymentRecoveryExecution): Promise<void>;
}
