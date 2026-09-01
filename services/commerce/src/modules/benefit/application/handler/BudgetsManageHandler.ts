import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { BudgetRepository } from '../port/BudgetRepository';
export class BudgetsManageHandler implements OperationHandler<'benefit.budgets.manage', 'write'> {
  readonly operation = 'benefit.budgets.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly budgets: BudgetRepository) {}
  async execute(input: OperationInputFor<'benefit.budgets.manage'>, context: WriteHandlerContext<'benefit.budgets.manage'>) {
    const result = await this.budgets.manageBudget(context.transaction, input, context);
    return result;
  }
}
