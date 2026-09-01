import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
export interface LedgerRepository {
  readLedger(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.ledgers.read'>, context: ExecutionContext<'benefit.ledgers.read'>): Promise<OperationReply<OperationOutputFor<'benefit.ledgers.read'>>>;
}
