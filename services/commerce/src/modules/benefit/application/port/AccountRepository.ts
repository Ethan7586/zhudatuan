import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
export interface AccountRepository {
  readAccounts(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.accounts.read'>, context: ExecutionContext<'benefit.accounts.read'>): Promise<OperationReply<OperationOutputFor<'benefit.accounts.read'>>>;
}
