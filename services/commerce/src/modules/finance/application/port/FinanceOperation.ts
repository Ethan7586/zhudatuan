import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export type FinanceOperation<TKey extends OperationId> = (transaction: ReadTransactionContext, input: OperationInputFor<TKey>, context: ExecutionContext<TKey>) => Promise<OperationReply<OperationOutputFor<TKey>>>;
