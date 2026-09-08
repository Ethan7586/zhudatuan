import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class StockRequestsSubmitHandler implements OperationHandler<'voucher.stockrequests.submit', 'write'> {
  readonly operation = 'voucher.stockrequests.submit' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'stockrequestsSubmit'>) {}
  execute(input: OperationInputFor<'voucher.stockrequests.submit'>, context: WriteHandlerContext<'voucher.stockrequests.submit'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.submit'>>> {
    return this.application.stockrequestsSubmit(input, context);
  }
}
