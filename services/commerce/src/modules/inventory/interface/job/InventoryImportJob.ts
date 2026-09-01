import { importId } from '../../../../foundation/application/BatchImport';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { InventoryImportProcess } from '../../application/process/InventoryImportProcess';

export class InventoryImportJob implements JobProcessor {
  constructor(private readonly imports: InventoryImportProcess) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'inventoryimport') throw new Error('JOB_KIND_MISMATCH');
    return this.imports.execute(importId(job.payload, 'INVENTORYIMPORT_REQUIRED'), job.scope_id ?? 'organization-platform-root', signal, deadline);
  }
}
