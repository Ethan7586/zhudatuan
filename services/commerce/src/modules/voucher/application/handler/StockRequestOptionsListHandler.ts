import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class StockRequestOptionsListHandler implements OperationHandler<'voucher.stockrequestoptions.list', 'read'> {
  readonly operation = 'voucher.stockrequestoptions.list' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'stockrequestoptionsList'>) {}
  execute(input: OperationInputFor<'voucher.stockrequestoptions.list'>, context: HandlerContext<'voucher.stockrequestoptions.list'>): Promise<OperationReply<OperationOutputFor<'voucher.stockrequestoptions.list'>>> {
    return this.application.stockrequestoptionsList(input, context);
  }
}
