import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { AgentRepository } from '../port/SupportRepositories';

export class AgentsReadHandler implements OperationHandler<'support.agents.read', 'read'> {
  readonly operation = 'support.agents.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly agents: AgentRepository) {}
  execute(input: OperationInputFor<'support.agents.read'>, context: HandlerContext<'support.agents.read'>): Promise<OperationReply<OperationOutputFor<'support.agents.read'>>> {
    const transaction = context.transaction;
    return this.agents.readAgents(transaction, input, context);
  }
}
