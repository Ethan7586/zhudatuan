import { resourceId } from '../../../../pipeline/Validation';
import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { InventoryImportProcess } from '../../application/process/InventoryImportProcess';

export class InventoryImportJob implements JobProcessor {
  constructor(private readonly imports: InventoryImportProcess) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'inventoryimport') throw new Error('JOB_KIND_MISMATCH');
    return this.imports.execute(resourceId(job.payload, 'import', 'import', 'INVENTORYIMPORT_REQUIRED'), job.scope ?? 'organization-platform-root', signal, deadline);
  }
}
