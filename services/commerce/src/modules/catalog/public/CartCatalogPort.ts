import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface CartListingSnapshot {
  readonly listing: string;
  readonly sku: string;
  readonly title: string;
  readonly version: number;
}
export interface CartCatalogPort {
  purchasable(context: ReadTransactionContext, listing: string, scope: string): Promise<CartListingSnapshot | null>;
  purchasableMany(context: ReadTransactionContext, listings: readonly string[], scope: string): Promise<ReadonlyMap<string, CartListingSnapshot>>;
}
export const CART_CATALOG_PORT = publicPort<CartCatalogPort>('catalog', 'cart');
