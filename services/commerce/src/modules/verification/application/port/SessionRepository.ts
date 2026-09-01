import type { QueryPage } from '../../../../foundation/interface/Validation';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface SessionRepository {
  read(context: ReadTransactionContext, scope: string, membership: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
