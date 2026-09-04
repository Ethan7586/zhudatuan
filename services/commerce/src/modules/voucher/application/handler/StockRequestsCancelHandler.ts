import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class StockRequestsCancelHandler implements OperationHandler<'voucher.stockrequests.cancel', 'write'> {
  readonly operation = 'voucher.stockrequests.cancel' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'stockrequestsCancel'>) {}
  execute(input: OperationInputFor<'voucher.stockrequests.cancel'>, context: WriteHandlerContext<'voucher.stockrequests.cancel'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.cancel'>>> {
    return this.application.stockrequestsCancel(input, context);
  }
}
