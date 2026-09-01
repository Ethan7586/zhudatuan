import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { BatchRepository } from '../port/BatchRepository';

export class StatusBatchesReadHandler implements OperationHandler<'voucher.statusbatches.read', 'read'> {
  readonly operation = 'voucher.statusbatches.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly batches: BatchRepository) {}
  async execute(input: OperationInputFor<'voucher.statusbatches.read'>, context: HandlerContext<'voucher.statusbatches.read'>) {
    const result = await this.batches.readStatusBatches(context.transaction, input, context);
    return result;
  }
}
