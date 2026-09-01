import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { RepairRepository } from '../port/OperationRepositories';

export class RepairsDecideHandler implements OperationHandler<'finance.reconciliationrepairs.decide', 'write'> {
  readonly operation = 'finance.reconciliationrepairs.decide' as const;
  readonly mode = 'write' as const;
  constructor(private readonly repairs: RepairRepository) {}
  async execute(input: OperationInputFor<'finance.reconciliationrepairs.decide'>, context: WriteHandlerContext<'finance.reconciliationrepairs.decide'>) {
    const result = await this.repairs.repairsDecide(context.transaction, input, context);
    return result;
  }
}
