import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { PoolRepository } from '../port/PoolRepository';

export class PoolsReadHandler implements OperationHandler<'catalog.pools.read', 'read'> {
  readonly operation = 'catalog.pools.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly pools: PoolRepository) {}
  async execute(input: OperationInputFor<'catalog.pools.read'>, context: HandlerContext<'catalog.pools.read'>): Promise<OperationReply<OperationOutputFor<'catalog.pools.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.pools.read(context.transaction, access.scope.id, page);
    return { status: 200, body: keysetPage(rows, page, 'name') as unknown as OperationOutputFor<'catalog.pools.read'> };
  }
}
