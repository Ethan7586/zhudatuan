import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { PoolRepository } from '../port/PoolRepository';

export class PoolsDetachHandler implements OperationHandler<'catalog.pools.detach', 'write'> {
  readonly operation = 'catalog.pools.detach' as const;
  readonly mode = 'write' as const;
  constructor(private readonly pools: PoolRepository) {}
  async execute(input: OperationInputFor<'catalog.pools.detach'>, context: WriteHandlerContext<'catalog.pools.detach'>): Promise<OperationReply<OperationOutputFor<'catalog.pools.detach'>>> {
    const access = requireSession(context.security);
    const row = await this.pools.detach(context.transaction, access.scope.id, input.path.scopeid, input.path.poolid, context.expectedVersion!);
    return { status: 200, body: row as OperationOutputFor<'catalog.pools.detach'> };
  }
}
