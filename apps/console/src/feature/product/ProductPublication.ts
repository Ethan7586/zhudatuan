export type ProductStatus = 'draft' | 'review' | 'active' | 'archived';

export function isPublishedListing(status: string): boolean {
  return status === 'published' || status === 'available';
}

export function canChangeListingPublication(listingStatus: string, productStatus: string | undefined): boolean {
  return isPublishedListing(listingStatus) || productStatus === 'active';
}

export function productStatus(value: string | undefined): ProductStatus {
  if (value === 'draft' || value === 'review' || value === 'active' || value === 'archived') return value;
  return 'draft';
}
