import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { PoolRepository } from '../port/PoolRepository';

export class PoolsAttachHandler implements OperationHandler<'catalog.pools.attach', 'write'> {
  readonly operation = 'catalog.pools.attach' as const;
  readonly mode = 'write' as const;
  constructor(private readonly pools: PoolRepository) {}
  async execute(input: OperationInputFor<'catalog.pools.attach'>, context: WriteHandlerContext<'catalog.pools.attach'>): Promise<OperationReply<OperationOutputFor<'catalog.pools.attach'>>> {
    const access = requireSession(context.security);
    const row = await this.pools.attach(context.transaction, access.scope.id, input.path.scopeid, input.path.poolid, context.expectedVersion!);
    return { status: 200, body: row as OperationOutputFor<'catalog.pools.attach'> };
  }
}
