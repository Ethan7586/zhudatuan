import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ImportCandidate, ImportPreparedBatch, ImportTarget } from '../../../runtime/public';

export interface CatalogImportRepository {
  prepare(context: ReadTransactionContext, scope: string, rows: readonly ImportCandidate[]): Promise<ImportPreparedBatch>;
  import(context: WriteTransactionContext, target: ImportTarget, row: number, value: Readonly<Record<string, string>>): Promise<void>;
  release(context: WriteTransactionContext, importId: string, scope: string): Promise<void>;
}
