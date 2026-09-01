import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { OrderRepository } from '../port/OrderRepository';

export class OrdersReceiveHandler implements OperationHandler<'order.orders.receive', 'write'> {
  readonly operation = 'order.orders.receive' as const;
  readonly mode = 'write' as const;
  constructor(private readonly orders: OrderRepository) {}
  execute(input: OperationInputFor<'order.orders.receive'>, context: WriteHandlerContext<'order.orders.receive'>): Promise<OperationReply<OperationOutputFor<'order.orders.receive'>>> {
    const transaction = context.transaction;
    return this.orders.receive(transaction, input, context);
  }
}
