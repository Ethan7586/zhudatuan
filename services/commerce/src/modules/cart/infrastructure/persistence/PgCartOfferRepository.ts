import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CartCatalogPort } from '../../../catalog/public';
import type { CartPricingPort } from '../../../pricing/public';
import type { CartOfferRepository } from '../../application/port/CartOfferRepository';

export class PgCartOfferRepository implements CartOfferRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly catalog: CartCatalogPort,
    private readonly pricing: CartPricingPort
  ) {}
  async resolve(context: ReadTransactionContext, mall: string, listingIds: readonly string[]) {
    if (listingIds.length === 0) return new Map();
    const database = this.transactions.database(context);
    const listings = await this.catalog.purchasableMany(context, listingIds, mall);
    const prices = await this.pricing.currentMany(
      context,
      mall,
      [...listings.values()].map(({ sku }) => sku)
    );
    return new Map(
      [...listings].flatMap(([listing, item]) => {
        const price = prices.get(item.sku);
        return price ? [[listing, Object.freeze({ listing, sku: item.sku, title: item.title, listingVersion: String(item.version), unitMinor: price.amountMinor, currency: price.currency, priceVersion: price.version })] as const] : [];
      })
    );
  }
}
