import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { BatchRepository } from '../port/BatchRepository';

export class StatusBatchHandler implements OperationHandler<'voucher.status.batch', 'write'> {
  readonly operation = 'voucher.status.batch' as const;
  readonly mode = 'write' as const;
  constructor(private readonly batches: BatchRepository) {}
  async execute(input: OperationInputFor<'voucher.status.batch'>, context: WriteHandlerContext<'voucher.status.batch'>) {
    const result = await this.batches.changeStatus(context.transaction, input, context);
    return result;
  }
}
