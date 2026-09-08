import type { QueryPage } from '../../../../pipeline/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ProviderOperationPort } from '../../public';

export interface ProviderOperationRepository extends ProviderOperationPort {
  read(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  replay(context: WriteTransactionContext, operation: string, scope: string): Promise<Readonly<Record<string, unknown>>>;
}
