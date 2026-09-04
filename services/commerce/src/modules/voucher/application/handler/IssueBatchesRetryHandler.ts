import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class IssueBatchesRetryHandler implements OperationHandler<'voucher.issuebatches.retry', 'write'> {
  readonly operation = 'voucher.issuebatches.retry' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'issuebatchesRetry'>) {}
  execute(input: OperationInputFor<'voucher.issuebatches.retry'>, context: WriteHandlerContext<'voucher.issuebatches.retry'>): Promise<OperationReply<OperationOutputFor<'voucher.issuebatches.retry'>>> {
    return this.application.issuebatchesRetry(input, context);
  }
}
