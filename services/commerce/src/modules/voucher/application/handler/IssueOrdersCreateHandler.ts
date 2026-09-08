import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class IssueOrdersCreateHandler implements OperationHandler<'voucher.issueorders.create', 'write'> {
  readonly operation = 'voucher.issueorders.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'issueordersCreate'>) {}
  execute(input: OperationInputFor<'voucher.issueorders.create'>, context: WriteHandlerContext<'voucher.issueorders.create'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.create'>>> {
    return this.application.issueordersCreate(input, context);
  }
}
