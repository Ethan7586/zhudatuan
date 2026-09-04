import type { QueryPage } from '../../../../foundation/application/Validation';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface CommissionRepository {
  read(context: ReadTransactionContext, scope: string, beneficiary: string | null, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  earnings(context: ReadTransactionContext, scope: string, beneficiary: string): Promise<Readonly<Record<string, unknown>>>;
}
