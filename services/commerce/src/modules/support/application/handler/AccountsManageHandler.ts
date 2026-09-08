import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { AccountRepository, PreparedSupportOperation } from '../port/SupportRepositories';

type Reply = OperationReply<OperationOutputFor<'support.accounts.manage'>>;

export class AccountsManageHandler implements DurableOperationHandler<'support.accounts.manage', PreparedSupportOperation, Reply, 'write', PreparedSupportOperation> {
  readonly operation = 'support.accounts.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly accounts: AccountRepository) {}
  load(input: OperationInputFor<'support.accounts.manage'>, context: HandlerContext<'support.accounts.manage'>) {
    return this.accounts.loadAccount(context.transaction, input, context);
  }
  prepare(input: OperationInputFor<'support.accounts.manage'>, context: PrepareContext<'support.accounts.manage'>, loaded: PreparedSupportOperation) {
    return this.accounts.prepareAccount(input, context, loaded);
  }
  async commit(input: OperationInputFor<'support.accounts.manage'>, prepared: PreparedSupportOperation, context: CommitContext<'support.accounts.manage'>): Promise<DurableCommit<Reply, OperationOutputFor<'support.accounts.manage'>>> {
    const response = await this.accounts.manageAccount(context.transaction, input, context, prepared);
    return { checkpoint: response, response };
  }
  finalize(_input: OperationInputFor<'support.accounts.manage'>, checkpoint: Reply, _context: FinalizeContext<'support.accounts.manage'>): Promise<Reply> {
    return Promise.resolve(checkpoint);
  }
}
