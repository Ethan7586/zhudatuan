import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { AfterSaleRepository } from '../port/AfterSaleRepository';

export class AfterSalesRejectHandler implements OperationHandler<'order.aftersales.reject', 'write'> {
  readonly operation = 'order.aftersales.reject' as const;
  readonly mode = 'write' as const;
  constructor(private readonly afterSales: AfterSaleRepository) {}
  execute(input: OperationInputFor<'order.aftersales.reject'>, context: WriteHandlerContext<'order.aftersales.reject'>): Promise<OperationReply<OperationOutputFor<'order.aftersales.reject'>>> {
    return this.afterSales.reject(context.transaction, input, context);
  }
}
