import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { RepairRepository } from '../port/OperationRepositories';

export class RepairsPreviewHandler implements OperationHandler<'finance.reconciliationrepairs.preview', 'write'> {
  readonly operation = 'finance.reconciliationrepairs.preview' as const;
  readonly mode = 'write' as const;
  constructor(private readonly repairs: RepairRepository) {}
  async execute(input: OperationInputFor<'finance.reconciliationrepairs.preview'>, context: WriteHandlerContext<'finance.reconciliationrepairs.preview'>) {
    const result = await this.repairs.repairsPreview(context.transaction, input, context);
    return result;
  }
}
