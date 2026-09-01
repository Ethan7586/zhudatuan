import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ConnectionRepository } from '../port/ConnectionRepository';
import { connectionConfiguration, secretReference } from '../service/ConnectionConfiguration';

export class ConnectionsUpdateHandler implements OperationHandler<'channel.connections.update', 'write'> {
  readonly operation = 'channel.connections.update' as const;
  readonly mode = 'write' as const;
  constructor(private readonly connections: ConnectionRepository) {}
  async execute(input: OperationInputFor<'channel.connections.update'>, context: WriteHandlerContext<'channel.connections.update'>): Promise<OperationReply<OperationOutputFor<'channel.connections.update'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const updated = await this.connections.update(context.transaction, {
      id: input.path.connectionid,
      scope: access.scope.id,
      actor: access.actor.id,
      trace: access.trace,
      secretRef: secretReference(body),
      configuration: connectionConfiguration(body),
      expectedVersion: context.expectedVersion ?? null,
    });
    return { status: 200, body: updated as OperationOutputFor<'channel.connections.update'> };
  }
}
