import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { AfterSaleRepository } from '../port/AfterSaleRepository';

export class AfterSalesApproveHandler implements OperationHandler<'order.aftersales.approve', 'write'> {
  readonly operation = 'order.aftersales.approve' as const;
  readonly mode = 'write' as const;
  constructor(private readonly afterSales: AfterSaleRepository) {}
  execute(input: OperationInputFor<'order.aftersales.approve'>, context: WriteHandlerContext<'order.aftersales.approve'>): Promise<OperationReply<OperationOutputFor<'order.aftersales.approve'>>> {
    return this.afterSales.approve(context.transaction, input, context);
  }
}
