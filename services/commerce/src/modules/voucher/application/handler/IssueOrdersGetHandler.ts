import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class IssueOrdersGetHandler implements OperationHandler<'voucher.issueorders.get', 'read'> {
  readonly operation = 'voucher.issueorders.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'issueordersGet'>) {}
  execute(input: OperationInputFor<'voucher.issueorders.get'>, context: HandlerContext<'voucher.issueorders.get'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.get'>>> {
    return this.application.issueordersGet(input, context);
  }
}
