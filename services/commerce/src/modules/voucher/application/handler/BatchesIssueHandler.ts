import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { BatchRepository } from '../port/BatchRepository';

export class BatchesIssueHandler implements OperationHandler<'voucher.batches.issue', 'write'> {
  readonly operation = 'voucher.batches.issue' as const;
  readonly mode = 'write' as const;
  constructor(private readonly batches: BatchRepository) {}
  async execute(input: OperationInputFor<'voucher.batches.issue'>, context: WriteHandlerContext<'voucher.batches.issue'>) {
    const result = await this.batches.issueBatch(context.transaction, input, context);
    return result;
  }
}
