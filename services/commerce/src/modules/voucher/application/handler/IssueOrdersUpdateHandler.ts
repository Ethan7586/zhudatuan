import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class IssueOrdersUpdateHandler implements OperationHandler<'voucher.issueorders.update', 'write'> {
  readonly operation = 'voucher.issueorders.update' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'issueordersUpdate'>) {}
  execute(input: OperationInputFor<'voucher.issueorders.update'>, context: WriteHandlerContext<'voucher.issueorders.update'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.update'>>> {
    return this.application.issueordersUpdate(input, context);
  }
}
