import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ProductReference {
  validate(context: ReadTransactionContext, scope: string, customer: string, qualification: string): Promise<void>;
}
