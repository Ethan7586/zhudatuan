import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
export interface AccountRepository {
  readAccounts(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.accounts.read'>, context: ExecutionContext<'benefit.accounts.read'>): Promise<OperationReply<OperationOutputFor<'benefit.accounts.read'>>>;
}
