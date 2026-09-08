import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class StockRequestsUpdateHandler implements OperationHandler<'voucher.stockrequests.update', 'write'> {
  readonly operation = 'voucher.stockrequests.update' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'stockrequestsUpdate'>) {}
  execute(input: OperationInputFor<'voucher.stockrequests.update'>, context: WriteHandlerContext<'voucher.stockrequests.update'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.update'>>> {
    return this.application.stockrequestsUpdate(input, context);
  }
}
