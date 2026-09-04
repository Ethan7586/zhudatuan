import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { OrderRepository } from '../port/OrderRepository';

export class OrdersCancelHandler implements OperationHandler<'order.orders.cancel', 'write'> {
  readonly operation = 'order.orders.cancel' as const;
  readonly mode = 'write' as const;

  constructor(private readonly orders: OrderRepository) {}

  execute(input: OperationInputFor<'order.orders.cancel'>, context: WriteHandlerContext<'order.orders.cancel'>): Promise<OperationReply<OperationOutputFor<'order.orders.cancel'>>> {
    return this.orders.cancel(context.transaction, input, context);
  }
}
