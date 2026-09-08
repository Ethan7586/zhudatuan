import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface CheckoutRepository {
  confirm(context: WriteTransactionContext, input: OperationInputFor<'order.orders.create'>, execution: ExecutionContext<'order.orders.create'>): Promise<OperationReply<OperationOutputFor<'order.orders.create'>>>;
}
