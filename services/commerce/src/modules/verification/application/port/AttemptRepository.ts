import type { QueryPage } from '../../../../pipeline/Validation';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export interface AttemptRepository {
  history(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
