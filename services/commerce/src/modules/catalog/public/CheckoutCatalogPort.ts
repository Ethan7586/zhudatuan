import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface CheckoutCatalogItem {
  readonly listing: string;
  readonly sku: string;
  readonly title: string;
  readonly listingVersion: number;
  readonly listingStatus: string;
  readonly product: string;
  readonly productType: string;
  readonly category: string;
  readonly productVersion: number;
  readonly skuVersion: number;
  readonly provider: string | null;
  readonly partner: string | null;
}
export interface CheckoutCatalogPort {
  items(context: ReadTransactionContext, scope: string, listings: readonly string[]): Promise<readonly CheckoutCatalogItem[]>;
}
export const CHECKOUT_CATALOG_PORT = publicPort<CheckoutCatalogPort>('catalog', 'checkout');
