import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { AccountRepository } from '../port/OperationRepositories';

export class HoldsReadHandler implements OperationHandler<'finance.holds.read', 'read'> {
  readonly operation = 'finance.holds.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly accounts: AccountRepository) {}
  async execute(input: OperationInputFor<'finance.holds.read'>, context: HandlerContext<'finance.holds.read'>) {
    const result = await this.accounts.holdsRead(context.transaction, input, context);
    return result;
  }
}
