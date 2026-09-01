import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { RepairRepository } from '../port/OperationRepositories';

export class RepairsSubmitHandler implements OperationHandler<'finance.reconciliationrepairs.submit', 'write'> {
  readonly operation = 'finance.reconciliationrepairs.submit' as const;
  readonly mode = 'write' as const;
  constructor(private readonly repairs: RepairRepository) {}
  async execute(input: OperationInputFor<'finance.reconciliationrepairs.submit'>, context: WriteHandlerContext<'finance.reconciliationrepairs.submit'>) {
    const result = await this.repairs.repairsSubmit(context.transaction, input, context);
    return result;
  }
}
