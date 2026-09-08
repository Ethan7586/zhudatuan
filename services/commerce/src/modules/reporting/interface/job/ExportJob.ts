import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ExportRunnerPort } from '../../../runtime/public';
import type { ExportReport } from '../../application/process/ExportReport';

export class ExportJob implements JobProcessor {
  constructor(
    private readonly runtime: ExportRunnerPort,
    private readonly exporter: ExportReport
  ) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    const id = text(object(job.payload).export, 'REPORT_EXPORT_REQUIRED');
    return this.runtime.executeExport('export', id, job, signal, deadline, this.exporter);
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
