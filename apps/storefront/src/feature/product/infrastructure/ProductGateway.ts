import type { ProductDto } from '../../../entity/product';
import type { StorefrontClient } from '../../../shared/api/Client';

export class ProductGateway {
  constructor(private readonly storefront: StorefrontClient['commerce']['storefront'], private readonly context: StorefrontClient['context']) {}
  async read(productId: string, signal?: AbortSignal): Promise<ProductDto | null> {
    const value = await this.storefront.catalogRead({ query: { productId, limit: 1 } }, this.context(null, { signal }));
    return value.items[0] ?? null;
  }
}
