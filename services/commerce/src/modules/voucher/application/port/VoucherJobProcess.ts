export interface VoucherJobExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export interface VoucherJobProcess {
  issue(batch: string, execution: VoucherJobExecution): Promise<void>;
  status(batch: string, execution: VoucherJobExecution): Promise<void>;
  expire(execution: VoucherJobExecution): Promise<void>;
}
