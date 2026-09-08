import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ListingRepository } from '../port/ListingRepository';
import type { ListingPublication } from '../service/ListingPublication';
import { DomainError } from '../../../../platform/error/DomainError';

export class ListingsPublishHandler implements OperationHandler<'catalog.listings.publish', 'write'> {
  readonly operation = 'catalog.listings.publish' as const;
  readonly mode = 'write' as const;
  constructor(private readonly publication: ListingPublication) {}
  async execute(input: OperationInputFor<'catalog.listings.publish'>, context: WriteHandlerContext<'catalog.listings.publish'>): Promise<OperationReply<OperationOutputFor<'catalog.listings.publish'>>> {
    const access = requireSession(context.security);
    const result = await this.publication.change(context.transaction, access.scope.id, [{ id: input.path.listingid, expectedVersion: context.expectedVersion! }], 'publish', access.actor.id, context.traceId);
    const receipt = result.items[0]!;
    if (receipt.state === 'failed') throw new DomainError(receipt.error as 'VERSION_CONFLICT' | 'RESOURCE_NOT_FOUND' | 'LISTING_NOT_PURCHASABLE', { gaps: receipt.gaps });
    return { status: 200, body: result.records[0] as unknown as OperationOutputFor<'catalog.listings.publish'>, events: result.events };
  }
}
