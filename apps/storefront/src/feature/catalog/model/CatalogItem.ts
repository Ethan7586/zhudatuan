import type { Product } from '../../../entity/product';

export interface CatalogItem {
  readonly product: Product;
  readonly listingVersion: string;
}
