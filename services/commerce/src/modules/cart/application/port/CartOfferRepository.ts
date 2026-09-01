import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface CartOffer {
  readonly listing: string;
  readonly sku: string;
  readonly title: string;
  readonly listingVersion: string;
  readonly unitMinor: number;
  readonly currency: string;
  readonly priceVersion: string;
}

export interface CartOfferRepository {
  resolve(context: ReadTransactionContext, mall: string, listings: readonly string[]): Promise<ReadonlyMap<string, CartOffer>>;
}
