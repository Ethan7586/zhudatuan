import type { OperationOutputFor } from '@shop/contract';
import type { CatalogPage } from '../model/CatalogPage';
import { mapProduct } from '../../../entity/product';

export function mapCatalog(value: OperationOutputFor<'storefront.catalog.read'>): CatalogPage {
  return Object.freeze({
    items: Object.freeze(value.items.map((item) => Object.freeze({ product: mapProduct(item), listingVersion: item.version }))),
    nextCursor: value.nextCursor,
    version: value.version,
    asOf: value.asOf,
  });
}
