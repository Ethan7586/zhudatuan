import type { OperationBodyFor } from '@shop/contract';
import { OP_CATALOG_LISTINGS_PRICE_SET, OP_CATALOG_LISTINGS_PUBLISH, type OP_CATALOG_LISTINGS_UNPUBLISH, OP_CATALOG_PRODUCTS_ARCHIVE, OP_CATALOG_PRODUCTS_CREATE, OP_CATALOG_PRODUCTS_UPDATE } from '@shop/contract/ids';
import type { Listing } from '../model/Product';
import type { ProductCommand, ProductPort } from '../public';

export type ProductCommandInput =
  | Readonly<{ operation: typeof OP_CATALOG_PRODUCTS_CREATE; body: OperationBodyFor<'CatalogProductsCreateInput'> }>
  | Readonly<{ operation: typeof OP_CATALOG_PRODUCTS_UPDATE; listing: Listing; expectedVersion: number; body: OperationBodyFor<'CatalogProductsUpdateInput'> }>
  | Readonly<{ operation: typeof OP_CATALOG_PRODUCTS_ARCHIVE; listing: Listing; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_CATALOG_LISTINGS_PUBLISH; listing: Listing }>
  | Readonly<{ operation: typeof OP_CATALOG_LISTINGS_UNPUBLISH; listing: Listing }>
  | Readonly<{ operation: typeof OP_CATALOG_LISTINGS_PRICE_SET; listing: Listing; expectedVersion: number; body: OperationBodyFor<'CatalogListingsPriceSetInput'> }>;

export class ExecuteProductAction {
  constructor(private readonly port: ProductPort) {}
  execute(request: ProductCommand, action: ProductCommandInput) {
    if (action.operation === OP_CATALOG_PRODUCTS_CREATE) return this.port.createProduct(request, action.body);
    if (action.operation === OP_CATALOG_PRODUCTS_UPDATE) return this.port.updateProduct(request, action.listing, action.expectedVersion, action.body);
    if (action.operation === OP_CATALOG_PRODUCTS_ARCHIVE) return this.port.archiveProduct(request, action.listing, action.expectedVersion);
    if (action.operation === OP_CATALOG_LISTINGS_PRICE_SET) return this.port.publishPrice(request, action.listing, action.body.amountMinor, action.expectedVersion);
    return this.port.changePublication(request, [action.listing], action.operation === OP_CATALOG_LISTINGS_PUBLISH);
  }
}
