import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface InventoryImportRepository {
  import(context: WriteTransactionContext, scope: string, importid: string, row: number, value: Readonly<Record<string, string>>): Promise<void>;
}
