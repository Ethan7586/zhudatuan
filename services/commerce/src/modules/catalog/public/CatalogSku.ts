import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface CatalogSku {
  find(context: ReadTransactionContext, scope: string, reference: string): Promise<string | null>;
}
