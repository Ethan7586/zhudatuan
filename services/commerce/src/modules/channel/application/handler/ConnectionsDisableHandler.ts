import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ConnectionRepository } from '../port/ConnectionRepository';

export class ConnectionsDisableHandler implements OperationHandler<'channel.connections.disable', 'write'> {
  readonly operation = 'channel.connections.disable' as const;
  readonly mode = 'write' as const;
  constructor(private readonly connections: ConnectionRepository) {}
  async execute(input: OperationInputFor<'channel.connections.disable'>, context: WriteHandlerContext<'channel.connections.disable'>): Promise<OperationReply<OperationOutputFor<'channel.connections.disable'>>> {
    const access = requireSession(context.security);
    const result = await this.connections.transition(context.transaction, {
      id: input.path.connectionid,
      scope: access.scope.id,
      actor: access.actor.id,
      trace: access.trace,
      state: 'disabled',
      expectedVersion: context.expectedVersion ?? null,
    });
    return { status: 200, body: result as OperationOutputFor<'channel.connections.disable'> };
  }
}
