import type { PaymentRecoveryExecution, PaymentRecoveryProcess } from '../port/PaymentRecoveryProcess';

export class RecoverPayment {
  constructor(private readonly process: PaymentRecoveryProcess) {}

  async query(intent: string, event: string | undefined, execution: PaymentRecoveryExecution): Promise<void> {
    await this.process.query(intent, execution);
    if (event) await this.process.completeEvent(event, execution);
  }

  async refund(refund: string | undefined, aftersale: string | undefined, event: string | undefined, execution: PaymentRecoveryExecution): Promise<void> {
    const id = refund ?? (await this.process.createRefund(required(aftersale, 'AFTERSALE_REQUIRED'), execution));
    await this.process.refund(id, execution.trace, execution);
    if (event) await this.process.completeEvent(event, execution);
  }
}

function required(value: string | undefined, code: string): string {
  if (!value) throw new Error(code);
  return value;
}
