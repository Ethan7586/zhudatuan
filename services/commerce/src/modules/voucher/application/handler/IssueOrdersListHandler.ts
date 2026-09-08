import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class IssueOrdersListHandler implements OperationHandler<'voucher.issueorders.list', 'read'> {
  readonly operation = 'voucher.issueorders.list' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'issueordersList'>) {}
  execute(input: OperationInputFor<'voucher.issueorders.list'>, context: HandlerContext<'voucher.issueorders.list'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.list'>>> {
    return this.application.issueordersList(input, context);
  }
}
