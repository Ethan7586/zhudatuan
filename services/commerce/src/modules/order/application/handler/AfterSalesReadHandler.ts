import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { AfterSaleRepository } from '../port/AfterSaleRepository';

export class AfterSalesReadHandler implements OperationHandler<'order.aftersales.read', 'read'> {
  readonly operation = 'order.aftersales.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly afterSales: AfterSaleRepository) {}
  execute(input: OperationInputFor<'order.aftersales.read'>, context: HandlerContext<'order.aftersales.read'>): Promise<OperationReply<OperationOutputFor<'order.aftersales.read'>>> {
    return this.afterSales.read(context.transaction, input, context);
  }
}
