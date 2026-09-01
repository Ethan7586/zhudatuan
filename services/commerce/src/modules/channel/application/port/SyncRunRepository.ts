import type { QueryPage } from '../../../../foundation/interface/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { SyncKind } from '../../domain/model/SyncRun';

export interface SyncRunRepository {
  start(context: WriteTransactionContext, input: Readonly<{ scope: string; connection: string; kind: SyncKind; cursor: unknown; parameters: Readonly<Record<string, unknown>> }>): Promise<Readonly<Record<string, unknown>>>;
  read(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  cancel(context: WriteTransactionContext, id: string, scope: string, expectedVersion: number | null): Promise<Readonly<Record<string, unknown>>>;
}
