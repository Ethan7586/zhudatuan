import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherApplication } from '../service/VoucherApplication';

export class ActionBatchesRetryHandler implements OperationHandler<'voucher.actionbatches.retry', 'write'> {
  readonly operation = 'voucher.actionbatches.retry' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'actionbatchesRetry'>) {}
  execute(input: OperationInputFor<'voucher.actionbatches.retry'>, context: WriteHandlerContext<'voucher.actionbatches.retry'>): Promise<OperationReply<OperationOutputFor<'voucher.actionbatches.retry'>>> {
    return this.application.actionbatchesRetry(input, context);
  }
}
