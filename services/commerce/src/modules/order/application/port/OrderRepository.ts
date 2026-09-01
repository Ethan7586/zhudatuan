import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface OrderRepository {
  read(context: ReadTransactionContext, input: OperationInputFor<'order.orders.read'>, execution: ExecutionContext<'order.orders.read'>): Promise<OperationReply<OperationOutputFor<'order.orders.read'>>>;
  receive(context: WriteTransactionContext, input: OperationInputFor<'order.orders.receive'>, execution: ExecutionContext<'order.orders.receive'>): Promise<OperationReply<OperationOutputFor<'order.orders.receive'>>>;
}
