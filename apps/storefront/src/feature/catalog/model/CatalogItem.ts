import type { ProductView } from '../../../shared/runtime/StorefrontPort';

export interface CatalogItem {
  readonly product: ProductView;
  readonly listingVersion: string;
}
