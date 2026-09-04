import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ProductsListHandler implements OperationHandler<'voucher.products.list', 'read'> {
  readonly operation = 'voucher.products.list' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'productsList'>) {}
  execute(input: OperationInputFor<'voucher.products.list'>, context: HandlerContext<'voucher.products.list'>): Promise<OperationReply<OperationOutputFor<'voucher.products.list'>>> {
    return this.application.productsList(input, context);
  }
}
