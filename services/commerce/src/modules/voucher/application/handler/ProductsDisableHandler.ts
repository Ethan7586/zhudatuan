import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ProductsDisableHandler implements OperationHandler<'voucher.products.disable', 'write'> {
  readonly operation = 'voucher.products.disable' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'productsDisable'>) {}
  execute(input: OperationInputFor<'voucher.products.disable'>, context: WriteHandlerContext<'voucher.products.disable'>): Promise<OperationReply<OperationOutputFor<'voucher.products.disable'>>> {
    return this.application.productsDisable(input, context);
  }
}
