import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { AccountReadRepository } from '../port/FinanceReadRepository';

export class PeriodsReadHandler implements OperationHandler<'finance.periods.read', 'read'> {
  readonly operation = 'finance.periods.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly accounts: AccountReadRepository) {}
  async execute(input: OperationInputFor<'finance.periods.read'>, context: HandlerContext<'finance.periods.read'>) {
    const result = await this.accounts.periodsRead(context.transaction, input, context);
    return result;
  }
}
