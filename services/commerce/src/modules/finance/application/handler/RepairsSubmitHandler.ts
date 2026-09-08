import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { RepairProcessAdapter } from '../port/FinanceProcessAdapter';

export class RepairsSubmitHandler implements OperationHandler<'finance.reconciliationrepairs.submit', 'write'> {
  readonly operation = 'finance.reconciliationrepairs.submit' as const;
  readonly mode = 'write' as const;
  constructor(private readonly repairs: RepairProcessAdapter) {}
  async execute(input: OperationInputFor<'finance.reconciliationrepairs.submit'>, context: WriteHandlerContext<'finance.reconciliationrepairs.submit'>) {
    const result = await this.repairs.repairsSubmit(context.transaction, input, context);
    return result;
  }
}
