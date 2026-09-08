import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export interface ProductReference {
  validate(context: ReadTransactionContext, scope: string, customer: string, qualification: string): Promise<void>;
}
