import { importId } from '../../../../foundation/application/BatchImport';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { MemberImportProcess } from '../../application/process/MemberImportProcess';

export class MemberImportJob implements JobProcessor {
  constructor(private readonly imports: MemberImportProcess) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'memberimport') throw new Error('JOB_KIND_MISMATCH');
    return this.imports.execute(importId(job.payload, 'MEMBERIMPORT_REQUIRED'), job.scope_id ?? 'organization-platform-root', signal, deadline);
  }
}
