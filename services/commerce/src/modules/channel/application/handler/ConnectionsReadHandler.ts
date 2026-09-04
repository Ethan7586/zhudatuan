import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ConnectionRepository } from '../port/ConnectionRepository';

export class ConnectionsReadHandler implements OperationHandler<'channel.connections.read', 'read'> {
  readonly operation = 'channel.connections.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly connections: ConnectionRepository) {}
  async execute(input: OperationInputFor<'channel.connections.read'>, context: HandlerContext<'channel.connections.read'>): Promise<OperationReply<OperationOutputFor<'channel.connections.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.connections.read(context.transaction, access.scope.id, page);
    return { status: 200, body: keysetPage(rows, page, 'id') as OperationOutputFor<'channel.connections.read'> };
  }
}
