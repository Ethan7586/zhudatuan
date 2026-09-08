import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class StockRequestsListHandler implements OperationHandler<'voucher.stockrequests.list', 'read'> {
  readonly operation = 'voucher.stockrequests.list' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'stockrequestsList'>) {}
  execute(input: OperationInputFor<'voucher.stockrequests.list'>, context: HandlerContext<'voucher.stockrequests.list'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequests.list'>>> {
    return this.application.stockrequestsList(input, context);
  }
}
