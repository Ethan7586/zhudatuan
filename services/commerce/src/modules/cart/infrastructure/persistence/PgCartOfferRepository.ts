import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CartCatalogPort } from '../../../catalog/public';
import type { InventoryReadPort } from '../../../inventory/public';
import type { CartPricingPort } from '../../../pricing/public';
import type { CartOfferReference, CartOfferRepository } from '../../application/port/CartOfferRepository';
import type { CartOffer } from '../../domain/model/CartLine';

export class PgCartOfferRepository implements CartOfferRepository {
  constructor(
    private readonly catalog: CartCatalogPort,
    private readonly pricing: CartPricingPort,
    private readonly inventory: InventoryReadPort
  ) {}

  async resolve(context: ReadTransactionContext, mall: string, references: readonly CartOfferReference[]): Promise<ReadonlyMap<string, CartOffer>> {
    const unique = [...new Map(references.map((item) => [item.listing, item])).values()];
    if (unique.length === 0) return new Map();
    const listings = await this.catalog.inspect(context, unique.map(({ listing }) => listing), mall);
    const skus = [...new Set(unique.flatMap((reference) => {
      const current = listings.get(reference.listing)?.sku;
      return current ? [current] : reference.sku ? [reference.sku] : [];
    }))];
    const [prices, stocks] = await Promise.all([this.pricing.currentMany(context, mall, skus), this.inventory.availability(context, mall, skus)]);
    const stockBySku = new Map(stocks.map((stock) => [stock.sku, stock]));
    return new Map(unique.map((reference) => {
      const listing = listings.get(reference.listing);
      const sku = listing?.sku || reference.sku || '';
      const price = prices.get(sku);
      const stock = stockBySku.get(sku);
      const code = listing?.code === 'valid' && !price ? 'unpriced' : listing?.code ?? 'unpublished';
      return [reference.listing, Object.freeze({
        listing: reference.listing,
        sku,
        title: listing?.title ?? null,
        amountMinor: price?.amountMinor ?? null,
        currency: price?.currency ?? null,
        available: stock?.available ?? 0,
        benefitApplicable: listing?.benefitApplicable ?? false,
        listingVersion: listing?.version === null || listing?.version === undefined ? null : String(listing.version),
        priceVersion: price?.version ?? null,
        inventoryVersion: stock?.version ?? null,
        code,
      })] as const;
    }));
  }
}
