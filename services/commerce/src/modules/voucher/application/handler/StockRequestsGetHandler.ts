import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class StockRequestsGetHandler implements OperationHandler<'voucher.stockrequests.get', 'read'> {
  readonly operation = 'voucher.stockrequests.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'stockrequestsGet'>) {}
  execute(input: OperationInputFor<'voucher.stockrequests.get'>, context: HandlerContext<'voucher.stockrequests.get'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.get'>>> {
    return this.application.stockrequestsGet(input, context);
  }
}
