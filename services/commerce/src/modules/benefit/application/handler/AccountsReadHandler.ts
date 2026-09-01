import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { AccountRepository } from '../port/AccountRepository';
export class AccountsReadHandler implements OperationHandler<'benefit.accounts.read', 'read'> {
  readonly operation = 'benefit.accounts.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly accounts: AccountRepository) {}
  async execute(input: OperationInputFor<'benefit.accounts.read'>, context: HandlerContext<'benefit.accounts.read'>) {
    const result = await this.accounts.readAccounts(context.transaction, input, context);
    return result;
  }
}
