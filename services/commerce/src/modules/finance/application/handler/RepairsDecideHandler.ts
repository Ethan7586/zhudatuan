import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { RepairProcessAdapter } from '../port/FinanceProcessAdapter';

export class RepairsDecideHandler implements OperationHandler<'finance.reconciliationrepairs.decide', 'write'> {
  readonly operation = 'finance.reconciliationrepairs.decide' as const;
  readonly mode = 'write' as const;
  constructor(private readonly repairs: RepairProcessAdapter) {}
  async execute(input: OperationInputFor<'finance.reconciliationrepairs.decide'>, context: WriteHandlerContext<'finance.reconciliationrepairs.decide'>) {
    const result = await this.repairs.repairsDecide(context.transaction, input, context);
    return result;
  }
}
