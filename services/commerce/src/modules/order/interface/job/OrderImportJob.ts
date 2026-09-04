import { resourceId } from '../../../../foundation/application/Validation';
import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { OrderImportProcess } from '../../application/process/OrderImportProcess';

export class OrderImportJob implements JobProcessor {
  constructor(private readonly imports: OrderImportProcess) {}
  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'orderimport') throw new Error('JOB_KIND_MISMATCH');
    return this.imports.execute(resourceId(job.payload, 'import', 'import', 'ORDERIMPORT_REQUIRED'), job.scope ?? 'organization-platform-root', signal, deadline);
  }
}
