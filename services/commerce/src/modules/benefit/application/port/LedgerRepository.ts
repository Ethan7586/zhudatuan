import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
export interface LedgerRepository {
  readLedger(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.ledgers.read'>, context: ExecutionContext<'benefit.ledgers.read'>): Promise<OperationReply<OperationOutputFor<'benefit.ledgers.read'>>>;
}
