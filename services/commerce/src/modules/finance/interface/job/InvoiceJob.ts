import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { IssueInvoice } from '../../application/process/IssueInvoice';

export class InvoiceJob implements JobProcessor {
  constructor(private readonly invoices: IssueInvoice) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'invoice') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const request = text(object(job.payload).request, 'INVOICE_REQUEST_REQUIRED');
    return this.invoices.execute(request, { scope: job.scope ?? 'organization-platform-root', trace: job.id, signal, deadline });
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
