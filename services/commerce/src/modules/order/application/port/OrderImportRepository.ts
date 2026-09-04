import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface OrderImportRepository {
  import(
    context: WriteTransactionContext,
    target: Readonly<{ id: string; scope: string }>,
    row: number,
    value: Readonly<Record<string, string>>
  ): Promise<void>;
}
