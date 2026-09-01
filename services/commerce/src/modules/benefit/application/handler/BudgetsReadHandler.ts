import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { BudgetRepository } from '../port/BudgetRepository';
export class BudgetsReadHandler implements OperationHandler<'benefit.budgets.read', 'read'> {
  readonly operation = 'benefit.budgets.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly budgets: BudgetRepository) {}
  async execute(input: OperationInputFor<'benefit.budgets.read'>, context: HandlerContext<'benefit.budgets.read'>) {
    const result = await this.budgets.readBudgets(context.transaction, input, context);
    return result;
  }
}
