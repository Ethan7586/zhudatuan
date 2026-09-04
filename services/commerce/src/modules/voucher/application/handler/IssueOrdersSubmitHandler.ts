import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class IssueOrdersSubmitHandler implements OperationHandler<'voucher.issueorders.submit', 'write'> {
  readonly operation = 'voucher.issueorders.submit' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'issueordersSubmit'>) {}
  execute(input: OperationInputFor<'voucher.issueorders.submit'>, context: WriteHandlerContext<'voucher.issueorders.submit'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorders.submit'>>> {
    return this.application.issueordersSubmit(input, context);
  }
}
