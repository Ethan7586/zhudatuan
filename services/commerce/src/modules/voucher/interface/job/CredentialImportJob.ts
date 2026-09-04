import { resourceId } from '../../../../foundation/application/Validation';
import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { CredentialImportProcess } from '../../application/process/CredentialImportProcess';

export class CredentialImportJob implements JobProcessor {
  constructor(private readonly task: CredentialImportProcess) {}
  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 120_000): Promise<void> {
    if (job.kind !== 'credentialimport') throw new Error('JOB_KIND_MISMATCH');
    return this.task.execute(resourceId(job.payload, 'import', 'import', 'VOUCHER_IMPORT_REQUIRED'), text(job.scope, 'VOUCHER_SCOPE_REQUIRED'), signal, deadline);
  }
}
function text(value: unknown, code: string): string { if (typeof value !== 'string' || value === '') throw new Error(code); return value; }
