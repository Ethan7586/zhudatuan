import { importId } from '../../../../foundation/application/BatchImport';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { VoucherImportProcess } from '../../application/process/VoucherImportProcess';

export class VoucherImportJob implements JobProcessor {
  constructor(private readonly imports: VoucherImportProcess) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'voucherimport') throw new Error('JOB_KIND_MISMATCH');
    return this.imports.execute(importId(job.payload, 'VOUCHERIMPORT_REQUIRED'), job.scope_id ?? 'organization-platform-root', signal, deadline);
  }
}
