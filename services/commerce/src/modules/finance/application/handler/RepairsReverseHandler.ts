import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { RepairRepository } from '../port/OperationRepositories';

export class RepairsReverseHandler implements OperationHandler<'finance.reconciliationrepairs.reverse', 'write'> {
  readonly operation = 'finance.reconciliationrepairs.reverse' as const;
  readonly mode = 'write' as const;
  constructor(private readonly repairs: RepairRepository) {}
  async execute(input: OperationInputFor<'finance.reconciliationrepairs.reverse'>, context: WriteHandlerContext<'finance.reconciliationrepairs.reverse'>) {
    const result = await this.repairs.repairsReverse(context.transaction, input, context);
    return result;
  }
}
