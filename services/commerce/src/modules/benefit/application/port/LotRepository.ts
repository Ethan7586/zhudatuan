import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
export interface LotRepository {
  readLots(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.lots.read'>, context: ExecutionContext<'benefit.lots.read'>): Promise<OperationReply<OperationOutputFor<'benefit.lots.read'>>>;
}
