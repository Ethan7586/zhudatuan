import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface OrderRepository {
  read(context: ReadTransactionContext, input: OperationInputFor<'order.orders.read'>, execution: ExecutionContext<'order.orders.read'>): Promise<OperationReply<OperationOutputFor<'order.orders.read'>>>;
  cancel(context: WriteTransactionContext, input: OperationInputFor<'order.orders.cancel'>, execution: ExecutionContext<'order.orders.cancel'>): Promise<OperationReply<OperationOutputFor<'order.orders.cancel'>>>;
  receive(context: WriteTransactionContext, input: OperationInputFor<'order.orders.receive'>, execution: ExecutionContext<'order.orders.receive'>): Promise<OperationReply<OperationOutputFor<'order.orders.receive'>>>;
}
