import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ProviderOperationRepository } from '../port/ProviderOperationRepository';

export class OperationsReadHandler implements OperationHandler<'channel.operations.read', 'read'> {
  readonly operation = 'channel.operations.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly operations: ProviderOperationRepository) {}
  async execute(input: OperationInputFor<'channel.operations.read'>, context: HandlerContext<'channel.operations.read'>): Promise<OperationReply<OperationOutputFor<'channel.operations.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.operations.read(context.transaction, access.scope.id, page);
    return { status: 200, body: keysetPage(rows, page, 'updated_at') as OperationOutputFor<'channel.operations.read'> };
  }
}
