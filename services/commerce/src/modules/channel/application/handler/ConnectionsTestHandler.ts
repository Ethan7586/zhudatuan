import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ConnectionRepository } from '../port/ConnectionRepository';

export class ConnectionsTestHandler implements OperationHandler<'channel.connections.test', 'write'> {
  readonly operation = 'channel.connections.test' as const;
  readonly mode = 'write' as const;
  constructor(private readonly connections: ConnectionRepository) {}
  async execute(input: OperationInputFor<'channel.connections.test'>, context: WriteHandlerContext<'channel.connections.test'>): Promise<OperationReply<OperationOutputFor<'channel.connections.test'>>> {
    const access = requireSession(context.security);
    const result = await this.connections.transition(context.transaction, { id: input.path.connectionid, scope: access.scope.id, actor: access.actor.id, trace: access.trace, state: 'testing', expectedVersion: context.expectedVersion ?? null });
    return { status: 202, body: result as OperationOutputFor<'channel.connections.test'> };
  }
}
