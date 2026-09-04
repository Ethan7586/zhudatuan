import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ProductsCreateHandler implements OperationHandler<'voucher.products.create', 'write'> {
  readonly operation = 'voucher.products.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'productsCreate'>) {}
  execute(input: OperationInputFor<'voucher.products.create'>, context: WriteHandlerContext<'voucher.products.create'>): Promise<OperationReply<OperationOutputFor<'voucher.products.create'>>> {
    return this.application.productsCreate(input, context);
  }
}
