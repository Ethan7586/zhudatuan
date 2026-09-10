import type { Listing } from '../model/Product';

export function productBatchItems(listings: readonly Listing[]) {
  return listings.map(({ id, version: value }) => ({ id, expectedVersion: productVersion(value) }));
}

export function productId(listing: Listing): string {
  if (typeof listing.product_id !== 'string' || listing.product_id === '') throw new Error('VALIDATION_FAILED');
  return listing.product_id;
}

export function productVersion(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('VALIDATION_FAILED');
  return parsed;
}
