import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { AccountReadRepository } from '../port/FinanceReadRepository';

export class HoldsReadHandler implements OperationHandler<'finance.holds.read', 'read'> {
  readonly operation = 'finance.holds.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly accounts: AccountReadRepository) {}
  async execute(input: OperationInputFor<'finance.holds.read'>, context: HandlerContext<'finance.holds.read'>) {
    const result = await this.accounts.holdsRead(context.transaction, input, context);
    return result;
  }
}
