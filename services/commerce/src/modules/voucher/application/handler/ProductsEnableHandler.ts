import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ProductsEnableHandler implements OperationHandler<'voucher.products.enable', 'write'> {
  readonly operation = 'voucher.products.enable' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'productsEnable'>) {}
  execute(input: OperationInputFor<'voucher.products.enable'>, context: WriteHandlerContext<'voucher.products.enable'>): Promise<OperationReply<OperationOutputFor<'voucher.products.enable'>>> {
    return this.application.productsEnable(input, context);
  }
}
