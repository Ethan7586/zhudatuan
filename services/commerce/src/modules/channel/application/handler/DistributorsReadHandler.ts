import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { DistributorRepository } from '../port/DistributorRepository';

export class DistributorsReadHandler implements OperationHandler<'channel.distributors.read', 'read'> {
  readonly operation = 'channel.distributors.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly distributors: DistributorRepository) {}
  async execute(input: OperationInputFor<'channel.distributors.read'>, context: HandlerContext<'channel.distributors.read'>): Promise<OperationReply<OperationOutputFor<'channel.distributors.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.distributors.read(context.transaction, access.scope.id, page);
    return { status: 200, body: keysetPage(rows, page, 'updated_at') as OperationOutputFor<'channel.distributors.read'> };
  }
}
