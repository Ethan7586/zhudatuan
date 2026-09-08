import { resourceId } from '../../../../pipeline/Validation';
import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { FinanceImportProcess } from '../../application/process/FinanceImportProcess';

export class StatementImportJob implements JobProcessor {
  constructor(private readonly imports: FinanceImportProcess) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'financeimport') throw new Error('JOB_KIND_MISMATCH');
    return this.imports.execute(resourceId(job.payload, 'import', 'import', 'FINANCE_IMPORT_REQUIRED'), job.scope ?? 'organization-platform-root', signal, deadline);
  }
}
