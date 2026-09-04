import { mapProduct, type Product } from '../../../entity/product';
import type { StorefrontOperations } from '@shop/sdk/storefront';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { ProductPort } from '../public/ProductPort';

export class ProductGateway implements ProductPort {
  constructor(
    private readonly storefront: StorefrontOperations,
    private readonly context: RequestContextFactory
  ) {}
  async read(productId: string, signal?: AbortSignal): Promise<Product | null> {
    const value = await this.storefront.catalogRead({ query: { productId, limit: 1 } }, this.context(null, { signal }));
    return value.items[0] ? mapProduct(value.items[0]) : null;
  }
}
