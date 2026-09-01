import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
export interface LotRepository {
  readLots(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.lots.read'>, context: ExecutionContext<'benefit.lots.read'>): Promise<OperationReply<OperationOutputFor<'benefit.lots.read'>>>;
}
