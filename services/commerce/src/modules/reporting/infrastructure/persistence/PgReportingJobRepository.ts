import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ReportingJobRepository } from '../../application/port/ReportingJobRepository';
import { ProjectEvent } from '../../application/service/ProjectEvent';
import type { ExportReport } from '../../domain/model/ExportJob';
import { PgReportingRepository } from './PgReportingRepository';

export class PgReportingJobRepository implements ReportingJobRepository {
  private readonly transactions = new PgTransactionAccess();

  async project(context: WriteTransactionContext, event: string) {
    const repository = this.repository(context);
    const claimed = await repository.claimEvent(event);
    return claimed ? new ProjectEvent(repository).execute(claimed) : [];
  }

  claimExport(context: WriteTransactionContext, id: string) {
    return this.repository(context).claimExport(id);
  }

  exportRows(context: ReadTransactionContext, id: string, report: ExportReport, cursor: string | null, fetch: number) {
    return this.repository(context).exportRows(id, report, cursor, fetch);
  }

  advanceExport(context: WriteTransactionContext, id: string, cursor: string, count: number): Promise<void> {
    return this.repository(context).advanceExport(id, cursor, count);
  }

  completeExport(context: WriteTransactionContext, id: string, object: Readonly<{ reference: string; sha256: string; size: number; scan: 'clean' }>): Promise<void> {
    return this.repository(context).completeExport(id, object);
  }

  failExport(context: WriteTransactionContext, id: string, code: string, terminal: boolean): Promise<void> {
    return this.repository(context).failExport(id, code, terminal);
  }

  private repository(context: ReadTransactionContext | WriteTransactionContext): PgReportingRepository {
    return new PgReportingRepository(this.transactions.database(context));
  }
}
