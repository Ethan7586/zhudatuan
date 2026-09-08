import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, integerField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { CatalogPriceCommandPort } from '../../../pricing/public';
import type { ListingPriceRepository } from '../port/ListingRepository';

export class ListingsPriceSetHandler implements OperationHandler<'catalog.listings.price.set', 'write'> {
  readonly operation = 'catalog.listings.price.set' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly listings: ListingPriceRepository,
    private readonly pricing: CatalogPriceCommandPort
  ) {}

  async execute(input: OperationInputFor<'catalog.listings.price.set'>, context: WriteHandlerContext<'catalog.listings.price.set'>): Promise<OperationReply<OperationOutputFor<'catalog.listings.price.set'>>> {
    const access = requireSession(context.security);
    const amountMinor = integerField(bodyRecord(input), 'amountMinor');
    if (amountMinor < 1) throw new DomainError('VALIDATION_FAILED', { field: 'amountMinor' });
    const target = await this.listings.priceTarget(context.transaction, input.path.listingid, access.scope.id);
    const price = await this.pricing.setPrice(context.transaction, { scope: target.scope, sku: target.sku, amountMinor, currency: 'CNY', expectedVersion: context.expectedVersion! });
    return {
      status: 200,
      body: {
        listing_id: target.listing,
        sku_id: target.sku,
        scope_id: target.scope,
        amount_minor: price.amountMinor,
        currency: price.currency,
        version: price.version,
        effective_at: price.effectiveAt,
        updated_at: price.updatedAt,
      },
    };
  }
}
