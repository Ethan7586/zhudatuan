import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ProductOptionsListHandler implements OperationHandler<'voucher.productoptions.list', 'read'> {
  readonly operation = 'voucher.productoptions.list' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'productoptionsList'>) {}
  execute(input: OperationInputFor<'voucher.productoptions.list'>, context: HandlerContext<'voucher.productoptions.list'>): Promise<OperationReply<OperationOutputFor<'voucher.productoptions.list'>>> {
    return this.application.productoptionsList(input, context);
  }
}
