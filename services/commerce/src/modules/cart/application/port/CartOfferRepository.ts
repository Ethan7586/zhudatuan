import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CartOffer } from '../../domain/model/CartLine';

export interface CartOfferReference {
  readonly listing: string;
  readonly sku: string | null;
}

export interface CartOfferRepository {
  resolve(context: ReadTransactionContext, mall: string, references: readonly CartOfferReference[]): Promise<ReadonlyMap<string, CartOffer>>;
}
