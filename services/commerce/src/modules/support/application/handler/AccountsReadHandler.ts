import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { AccountRepository } from '../port/SupportRepositories';

export class AccountsReadHandler implements OperationHandler<'support.accounts.read', 'read'> {
  readonly operation = 'support.accounts.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly accounts: AccountRepository) {}
  execute(input: OperationInputFor<'support.accounts.read'>, context: HandlerContext<'support.accounts.read'>): Promise<OperationReply<OperationOutputFor<'support.accounts.read'>>> {
    const transaction = context.transaction;
    return this.accounts.readAccounts(transaction, input, context);
  }
}
