import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExportJob, ExportReport, ExportRow } from '../../domain/model/ExportJob';

export interface ReportingJobRepository {
  project(context: WriteTransactionContext, event: string): Promise<readonly Readonly<{ scope: string; version: number }>[]>;
  claimExport(context: WriteTransactionContext, id: string): Promise<ExportJob | null>;
  exportRows(context: ReadTransactionContext, id: string, report: ExportReport, cursor: string | null, fetch: number): Promise<readonly ExportRow[]>;
  exportCount(context: ReadTransactionContext, id: string, report: ExportReport): Promise<number | null>;
  advanceExport(context: WriteTransactionContext, id: string, cursor: string, count: number): Promise<void>;
  completeExport(context: WriteTransactionContext, id: string, object: Readonly<{ reference: string; sha256: string; size: number; scan: 'clean' }>): Promise<void>;
  failExport(context: WriteTransactionContext, id: string, code: string, terminal: boolean): Promise<void>;
}
