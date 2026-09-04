import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ListingRepository } from '../port/ListingRepository';
import type { ListingPublication } from '../service/ListingPublication';
import { DomainError } from '../../../../foundation/domain/DomainError';

export class ListingsUnpublishHandler implements OperationHandler<'catalog.listings.unpublish', 'write'> {
  readonly operation = 'catalog.listings.unpublish' as const;
  readonly mode = 'write' as const;
  constructor(private readonly publication: ListingPublication) {}
  async execute(input: OperationInputFor<'catalog.listings.unpublish'>, context: WriteHandlerContext<'catalog.listings.unpublish'>): Promise<OperationReply<OperationOutputFor<'catalog.listings.unpublish'>>> {
    const access = requireSession(context.security);
    const result = await this.publication.change(context.transaction, access.scope.id, [{ id: input.path.listingid, expectedVersion: context.expectedVersion! }], 'unpublish', access.actor.id, context.traceId);
    const receipt = result.items[0]!;
    if (receipt.state === 'failed') throw new DomainError(receipt.error as 'VERSION_CONFLICT' | 'RESOURCE_NOT_FOUND' | 'LISTING_NOT_PURCHASABLE', { gaps: receipt.gaps });
    return { status: 200, body: result.records[0] as unknown as OperationOutputFor<'catalog.listings.unpublish'>, events: result.events };
  }
}
