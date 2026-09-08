import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { PoolRepository } from '../port/PoolRepository';

export class PoolsAllocateHandler implements OperationHandler<'catalog.pools.allocate', 'write'> {
  readonly operation = 'catalog.pools.allocate' as const;
  readonly mode = 'write' as const;
  constructor(private readonly pools: PoolRepository) {}
  async execute(input: OperationInputFor<'catalog.pools.allocate'>, context: WriteHandlerContext<'catalog.pools.allocate'>): Promise<OperationReply<OperationOutputFor<'catalog.pools.allocate'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const row = await this.pools.allocate(context.transaction, {
      accessScope: access.scope.id,
      platform: access.scope.kind === 'platform',
      source: input.path.poolid,
      scope: textField(body, 'scope'),
      kind: body.kind === 'markup' ? 'markup' : 'channel',
      name: textField(body, 'name'),
    });
    return { status: 201, body: row as OperationOutputFor<'catalog.pools.allocate'> };
  }
}
