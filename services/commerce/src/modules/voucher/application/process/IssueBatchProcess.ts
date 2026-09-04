export interface IssueBatchWork {
  issue(input: Readonly<{ job: string; batch: string; scope: string; signal: AbortSignal; deadline: number }>): Promise<void>;
  approval(input: Readonly<{ event: string; type: string; scope: string; payload: Readonly<Record<string, unknown>>; signal: AbortSignal; deadline: number }>): Promise<void>;
}

export class IssueBatchProcess {
  constructor(private readonly work: IssueBatchWork) {}
  execute(job: string, batch: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    if (!job || !batch || !scope) throw new Error('VOUCHER_ISSUE_PAYLOAD_INVALID');
    return this.work.issue(Object.freeze({ job, batch, scope, signal, deadline }));
  }
  decide(event: string, type: string, scope: string, payload: Readonly<Record<string, unknown>>, signal: AbortSignal, deadline: number): Promise<void> {
    if (!event || !scope || !['approval.instance.approved', 'approval.instance.rejected'].includes(type)) throw new Error('VOUCHER_APPROVAL_EVENT_INVALID');
    return this.work.approval(Object.freeze({ event, type, scope, payload, signal, deadline }));
  }
}
