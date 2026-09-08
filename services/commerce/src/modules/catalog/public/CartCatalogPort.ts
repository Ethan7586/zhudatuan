import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface CartListingSnapshot {
  readonly listing: string;
  readonly sku: string;
  readonly title: string | null;
  readonly version: number | null;
  readonly benefitApplicable: boolean;
  readonly code: 'valid' | 'unpublished' | 'unavailable' | 'outofscope';
}
export interface CartCatalogPort {
  inspect(context: ReadTransactionContext, listings: readonly string[], scope: string): Promise<ReadonlyMap<string, CartListingSnapshot>>;
}
export const CART_CATALOG_PORT = publicPort<CartCatalogPort>('catalog', 'cart');
