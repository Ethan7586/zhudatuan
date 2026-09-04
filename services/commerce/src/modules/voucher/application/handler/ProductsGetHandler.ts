import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ProductsGetHandler implements OperationHandler<'voucher.products.get', 'read'> {
  readonly operation = 'voucher.products.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'productsGet'>) {}
  execute(input: OperationInputFor<'voucher.products.get'>, context: HandlerContext<'voucher.products.get'>): Promise<OperationReply<OperationOutputFor<'voucher.products.get'>>> {
    return this.application.productsGet(input, context);
  }
}
