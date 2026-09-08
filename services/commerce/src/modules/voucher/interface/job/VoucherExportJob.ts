import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ExportRunnerPort } from '../../../runtime/public';
import type { VoucherExportProcess } from '../../application/process/VoucherExportProcess';

export class VoucherExportJob implements JobProcessor {
  constructor(
    private readonly runtime: ExportRunnerPort,
    private readonly renderer: VoucherExportProcess
  ) {}
  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 120_000): Promise<void> {
    const payload = record(job.payload);
    const id = text(payload.export, 'VOUCHER_EXPORT_REQUIRED');
    return this.runtime.executeExport('voucherexport', id, job, signal, deadline, this.renderer);
  }
}
function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value === '') throw new Error(code);
  return value;
}
