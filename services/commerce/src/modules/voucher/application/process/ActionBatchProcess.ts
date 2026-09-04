export interface ActionBatchWork {
  execute(input: Readonly<{ job: string; batch: string; scope: string; signal: AbortSignal; deadline: number }>): Promise<void>;
  maintain(input: Readonly<{ job: string; signal: AbortSignal; deadline: number }>): Promise<void>;
}

export class ActionBatchProcess {
  constructor(private readonly work: ActionBatchWork) {}
  execute(job: string, batch: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    if (!job || !batch || !scope) throw new Error('VOUCHER_ACTION_PAYLOAD_INVALID');
    return this.work.execute(Object.freeze({ job, batch, scope, signal, deadline }));
  }
  maintain(job: string, signal: AbortSignal, deadline: number): Promise<void> {
    if (!job) throw new Error('VOUCHER_MAINTENANCE_PAYLOAD_INVALID');
    return this.work.maintain(Object.freeze({ job, signal, deadline }));
  }
}
