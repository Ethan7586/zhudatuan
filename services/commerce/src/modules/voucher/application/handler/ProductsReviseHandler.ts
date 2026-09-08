import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ProductsReviseHandler implements OperationHandler<'voucher.products.revise', 'write'> {
  readonly operation = 'voucher.products.revise' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'productsRevise'>) {}
  execute(input: OperationInputFor<'voucher.products.revise'>, context: WriteHandlerContext<'voucher.products.revise'>): Promise<OperationReply<OperationOutputFor<'voucher.products.revise'>>> {
    return this.application.productsRevise(input, context);
  }
}
