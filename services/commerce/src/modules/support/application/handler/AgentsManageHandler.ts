import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { AgentRepository } from '../port/SupportRepositories';

export class AgentsManageHandler implements OperationHandler<'support.agents.manage', 'write'> {
  readonly operation = 'support.agents.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly agents: AgentRepository) {}
  execute(input: OperationInputFor<'support.agents.manage'>, context: WriteHandlerContext<'support.agents.manage'>): Promise<OperationReply<OperationOutputFor<'support.agents.manage'>>> {
    const transaction = context.transaction;
    return this.agents.manageAgent(transaction, input, context);
  }
}
