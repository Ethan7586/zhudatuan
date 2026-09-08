import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { AccountReadRepository } from '../port/FinanceReadRepository';

export class OverviewReadHandler implements OperationHandler<'finance.overview.read', 'read'> {
  readonly operation = 'finance.overview.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly accounts: AccountReadRepository) {}
  async execute(input: OperationInputFor<'finance.overview.read'>, context: HandlerContext<'finance.overview.read'>) {
    const result = await this.accounts.overviewRead(context.transaction, input, context);
    return result;
  }
}
