import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ExportReport } from '../../application/process/ExportReport';

export class ExportJob implements JobProcessor {
  constructor(private readonly exporter: ExportReport) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'export') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const id = text(object(job.payload).export, 'REPORT_EXPORT_REQUIRED');
    return this.exporter.execute(id, {
      scope: job.scope_id ?? 'reporting',
      trace: job.id,
      attempts: job.attempts,
      signal,
      deadline,
    });
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
