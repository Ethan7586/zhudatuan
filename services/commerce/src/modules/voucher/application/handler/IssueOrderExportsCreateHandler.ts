import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class IssueOrderExportsCreateHandler implements OperationHandler<'voucher.issueorderexports.create', 'write'> {
  readonly operation = 'voucher.issueorderexports.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'issueorderexportsCreate'>) {}
  execute(input: OperationInputFor<'voucher.issueorderexports.create'>, context: WriteHandlerContext<'voucher.issueorderexports.create'>): Promise<OperationReply<OperationOutputFor<'voucher.issueorderexports.create'>>> {
    return this.application.issueorderexportsCreate(input, context);
  }
}
