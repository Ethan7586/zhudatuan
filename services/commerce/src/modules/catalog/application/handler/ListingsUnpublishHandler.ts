import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ListingRepository } from '../port/ListingRepository';

export class ListingsUnpublishHandler implements OperationHandler<'catalog.listings.unpublish', 'write'> {
  readonly operation = 'catalog.listings.unpublish' as const;
  readonly mode = 'write' as const;
  constructor(private readonly listings: ListingRepository) {}
  async execute(input: OperationInputFor<'catalog.listings.unpublish'>, context: WriteHandlerContext<'catalog.listings.unpublish'>): Promise<OperationReply<OperationOutputFor<'catalog.listings.unpublish'>>> {
    const access = requireSession(context.security);
    const row = await this.listings.unpublish(context.transaction, input.path.listingid, access.scope.id, context.expectedVersion ?? null);
    return { status: 200, body: row as unknown as OperationOutputFor<'catalog.listings.unpublish'> };
  }
}
