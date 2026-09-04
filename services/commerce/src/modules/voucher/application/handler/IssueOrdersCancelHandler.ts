import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class IssueOrdersCancelHandler implements OperationHandler<'voucher.issueorders.cancel', 'write'> {
  readonly operation = 'voucher.issueorders.cancel' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'issueordersCancel'>) {}
  execute(input: OperationInputFor<'voucher.issueorders.cancel'>, context: WriteHandlerContext<'voucher.issueorders.cancel'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.cancel'>>> {
    return this.application.issueordersCancel(input, context);
  }
}
