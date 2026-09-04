import type { Listing } from './Product';

export type ProductStatus = 'draft' | 'review' | 'active' | 'archived';
export type ProductAction =
  | Readonly<{ kind: 'create' }>
  | Readonly<{ kind: 'edit'; listing: Listing; status: ProductStatus }>
  | Readonly<{ kind: 'archive'; listing: Listing }>
  | Readonly<{ kind: 'price'; listing: Listing }>
  | Readonly<{ kind: 'publish'; listing: Listing }>
  | Readonly<{ kind: 'unpublish'; listing: Listing }>;

export function isPublishedListing(status: string): boolean {
  return status === 'published' || status === 'available';
}
export function canChangeListingPublication(listingStatus: string, productStatus: string | undefined): boolean {
  return isPublishedListing(listingStatus) || productStatus === 'active';
}
export function productStatus(value: string | undefined): ProductStatus {
  return value === 'draft' || value === 'review' || value === 'active' || value === 'archived' ? value : 'draft';
}
