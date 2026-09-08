import type { QueryPage } from '../../../../pipeline/Validation';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export interface CommissionRepository {
  read(context: ReadTransactionContext, scope: string, beneficiary: string | null, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  earnings(context: ReadTransactionContext, scope: string, beneficiary: string): Promise<Readonly<Record<string, unknown>>>;
}
