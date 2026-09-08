import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ConnectionRepository } from '../port/ConnectionRepository';

export class ConnectionsEnableHandler implements OperationHandler<'channel.connections.enable', 'write'> {
  readonly operation = 'channel.connections.enable' as const;
  readonly mode = 'write' as const;
  constructor(private readonly connections: ConnectionRepository) {}
  async execute(input: OperationInputFor<'channel.connections.enable'>, context: WriteHandlerContext<'channel.connections.enable'>): Promise<OperationReply<OperationOutputFor<'channel.connections.enable'>>> {
    const access = requireSession(context.security);
    const result = await this.connections.transition(context.transaction, {
      id: input.path.connectionid,
      scope: access.scope.id,
      actor: access.actor.id,
      trace: access.trace,
      state: 'enabled',
      expectedVersion: context.expectedVersion ?? null,
    });
    return { status: 200, body: result as OperationOutputFor<'channel.connections.enable'> };
  }
}
