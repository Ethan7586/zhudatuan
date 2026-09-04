import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ListingPoolRepository } from '../port/ListingRepository';

export class ListingsPoolSetHandler implements OperationHandler<'catalog.listings.pool.set', 'write'> {
  readonly operation = 'catalog.listings.pool.set' as const;
  readonly mode = 'write' as const;

  constructor(private readonly listings: ListingPoolRepository) {}

  async execute(input: OperationInputFor<'catalog.listings.pool.set'>, context: WriteHandlerContext<'catalog.listings.pool.set'>): Promise<OperationReply<OperationOutputFor<'catalog.listings.pool.set'>>> {
    const access = requireSession(context.security);
    const pool = bodyRecord(input).pool;
    const changed = await this.listings.changePool(context.transaction, input.path.listingid, access.scope.id, typeof pool === 'string' ? pool : null, context.expectedVersion!);
    return { status: 200, body: changed as OperationOutputFor<'catalog.listings.pool.set'> };
  }
}
