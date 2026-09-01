import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface CheckoutRepository {
  confirm(context: WriteTransactionContext, input: OperationInputFor<'order.orders.create'>, execution: ExecutionContext<'order.orders.create'>): Promise<OperationReply<OperationOutputFor<'order.orders.create'>>>;
}
