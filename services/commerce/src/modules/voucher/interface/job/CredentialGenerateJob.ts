import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { CredentialGenerateProcess } from '../../application/process/CredentialGenerateProcess';

export class CredentialGenerateJob implements JobProcessor {
  constructor(private readonly task: CredentialGenerateProcess) {}
  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 120_000): Promise<void> {
    if (job.kind !== 'credentialgenerate') throw new Error('JOB_KIND_MISMATCH');
    const payload = record(job.payload);
    return this.task.execute(
      job.id,
      text(payload.pool, 'VOUCHER_POOL_REQUIRED'),
      integer(payload.count, 'VOUCHER_COUNT_INVALID'),
      integer(payload.start, 'VOUCHER_START_INVALID'),
      text(job.scope, 'VOUCHER_SCOPE_REQUIRED'),
      signal,
      deadline
    );
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
function integer(value: unknown, code: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) throw new Error(code);
  return result;
}
