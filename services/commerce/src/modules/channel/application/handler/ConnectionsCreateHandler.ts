import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ConnectionRepository } from '../port/ConnectionRepository';
import { connectionConfiguration, connectionProvider, secretReference } from '../service/ConnectionConfiguration';

export class ConnectionsCreateHandler implements OperationHandler<'channel.connections.create', 'write'> {
  readonly operation = 'channel.connections.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly connections: ConnectionRepository) {}
  async execute(input: OperationInputFor<'channel.connections.create'>, context: WriteHandlerContext<'channel.connections.create'>): Promise<OperationReply<OperationOutputFor<'channel.connections.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const created = await this.connections.create(context.transaction, {
      id: `connection:${randomUUID()}`,
      provider: connectionProvider(body),
      scope: access.scope.id,
      actor: access.actor.id,
      trace: access.trace,
      secretRef: secretReference(body, false) ?? null,
      configuration: connectionConfiguration(body),
    });
    return { status: 201, body: created as OperationOutputFor<'channel.connections.create'> };
  }
}
