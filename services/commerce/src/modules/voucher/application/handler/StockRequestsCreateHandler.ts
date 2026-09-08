import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class StockRequestsCreateHandler implements OperationHandler<'voucher.stockrequests.create', 'write'> {
  readonly operation = 'voucher.stockrequests.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'stockrequestsCreate'>) {}
  execute(input: OperationInputFor<'voucher.stockrequests.create'>, context: WriteHandlerContext<'voucher.stockrequests.create'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.create'>>> {
    return this.application.stockrequestsCreate(input, context);
  }
}
