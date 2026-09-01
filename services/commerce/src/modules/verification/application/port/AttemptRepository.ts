import type { QueryPage } from '../../../../foundation/interface/Validation';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface AttemptRepository {
  history(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
