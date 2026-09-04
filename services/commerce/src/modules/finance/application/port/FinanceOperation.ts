import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export type FinanceOperation<TKey extends OperationId> = (
  transaction: ReadTransactionContext,
  input: OperationInputFor<TKey>,
  context: ExecutionContext<TKey>
) => Promise<OperationReply<OperationOutputFor<TKey>>>;
