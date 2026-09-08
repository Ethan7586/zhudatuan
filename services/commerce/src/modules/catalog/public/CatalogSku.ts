import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface CatalogSku {
  find(context: ReadTransactionContext, scope: string, reference: string): Promise<string | null>;
}
