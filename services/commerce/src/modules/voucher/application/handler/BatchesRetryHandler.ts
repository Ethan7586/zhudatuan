import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { BatchRepository } from '../port/BatchRepository';

export class BatchesRetryHandler implements OperationHandler<'voucher.batches.retry', 'write'> {
  readonly operation = 'voucher.batches.retry' as const;
  readonly mode = 'write' as const;
  constructor(private readonly batches: BatchRepository) {}
  async execute(input: OperationInputFor<'voucher.batches.retry'>, context: WriteHandlerContext<'voucher.batches.retry'>) {
    const result = await this.batches.retryBatch(context.transaction, input, context);
    return result;
  }
}
