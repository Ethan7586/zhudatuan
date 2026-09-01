import type { VoucherJobExecution, VoucherJobProcess } from '../port/VoucherJobProcess';

export class RunVoucherBatch {
  constructor(private readonly process: VoucherJobProcess) {}

  issue(batch: string, execution: VoucherJobExecution): Promise<void> {
    return this.process.issue(batch, execution);
  }

  status(batch: string, execution: VoucherJobExecution): Promise<void> {
    return this.process.status(batch, execution);
  }

  expire(execution: VoucherJobExecution): Promise<void> {
    return this.process.expire(execution);
  }
}
