import type { QueryPage } from '../../../../pipeline/Validation';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export interface SessionRepository {
  read(context: ReadTransactionContext, scope: string, membership: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
