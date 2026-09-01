import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { BatchRepository } from '../port/BatchRepository';

export class BatchesReadHandler implements OperationHandler<'voucher.batches.read', 'read'> {
  readonly operation = 'voucher.batches.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly batches: BatchRepository) {}
  async execute(input: OperationInputFor<'voucher.batches.read'>, context: HandlerContext<'voucher.batches.read'>) {
    const result = await this.batches.readBatches(context.transaction, input, context);
    return result;
  }
}
