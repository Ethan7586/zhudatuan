import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
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
      secretRef: secretReference(body, true),
      configuration: connectionConfiguration(body),
      expectedVersion: context.expectedVersion ?? null,
    });
    return { status: 200, body: updated as OperationOutputFor<'channel.connections.update'> };
  }
}
