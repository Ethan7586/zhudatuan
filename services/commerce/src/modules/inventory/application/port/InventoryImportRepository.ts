import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface InventoryImportRepository {
  import(context: WriteTransactionContext, scope: string, importid: string, row: number, value: Readonly<Record<string, string>>): Promise<void>;
}
