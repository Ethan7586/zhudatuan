import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { OrderRepository } from '../port/OrderRepository';

export class OrdersReadHandler implements OperationHandler<'order.orders.read', 'read'> {
  readonly operation = 'order.orders.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly orders: OrderRepository) {}
  execute(input: OperationInputFor<'order.orders.read'>, context: HandlerContext<'order.orders.read'>): Promise<OperationReply<OperationOutputFor<'order.orders.read'>>> {
    const transaction = context.transaction;
    return this.orders.read(transaction, input, context);
  }
}
