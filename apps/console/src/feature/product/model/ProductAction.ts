import { OP_CATALOG_LISTINGS_PRICE_SET, OP_CATALOG_LISTINGS_PUBLISH, OP_CATALOG_LISTINGS_UNPUBLISH, OP_CATALOG_PRODUCTS_ARCHIVE, OP_CATALOG_PRODUCTS_CREATE, OP_CATALOG_PRODUCTS_UPDATE } from '@shop/contract/ids';
import { isPublishedProduct, type ProductStatus } from '@shop/presentation';
import type { Listing } from './Product';

export type ManagedListing = Extract<Listing, Readonly<{ pool_id: string | null }>>;

export type ProductAction =
  | Readonly<{ operation: typeof OP_CATALOG_PRODUCTS_CREATE }>
  | Readonly<{ operation: typeof OP_CATALOG_PRODUCTS_UPDATE; listing: Listing; status: ProductStatus; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_CATALOG_PRODUCTS_ARCHIVE; listing: Listing; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_CATALOG_LISTINGS_PRICE_SET; listing: Listing; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_CATALOG_LISTINGS_PUBLISH; listing: Listing }>
  | Readonly<{ operation: typeof OP_CATALOG_LISTINGS_UNPUBLISH; listing: Listing }>;

export function isPublishedListing(status: string): boolean {
  return isPublishedProduct(status);
}
export function isManagedListing(listing: Listing): listing is ManagedListing {
  return 'pool_id' in listing;
}
export function canChangeListingPublication(listingStatus: string, productStatus: string | undefined): boolean {
  return isPublishedListing(listingStatus) || productStatus === 'active';
}

export function productVersion(value: string | number | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
