import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface OrderImportRepository {
  import(context: WriteTransactionContext, target: Readonly<{ id: string; scope: string }>, row: number, value: Readonly<Record<string, string>>): Promise<void>;
}
