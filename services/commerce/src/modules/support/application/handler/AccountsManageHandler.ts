import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { AccountRepository } from '../port/SupportRepositories';

export class AccountsManageHandler implements OperationHandler<'support.accounts.manage', 'write'> {
  readonly operation = 'support.accounts.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly accounts: AccountRepository) {}
  execute(input: OperationInputFor<'support.accounts.manage'>, context: WriteHandlerContext<'support.accounts.manage'>): Promise<OperationReply<OperationOutputFor<'support.accounts.manage'>>> {
    const transaction = context.transaction;
    return this.accounts.manageAccount(transaction, input, context);
  }
}
