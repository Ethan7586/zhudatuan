import { importId } from '../../../../foundation/application/BatchImport';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { CatalogImportProcess } from '../../application/process/CatalogImportProcess';

export class CatalogImportJob implements JobProcessor {
  constructor(private readonly imports: CatalogImportProcess) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'catalogimport') throw new Error('JOB_KIND_MISMATCH');
    return this.imports.execute(importId(job.payload, 'CATALOGIMPORT_REQUIRED'), job.scope_id ?? 'organization-platform-root', signal, deadline);
  }
}
