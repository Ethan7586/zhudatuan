import { mapProductDetail, type Product, type ProductDto } from '../../../entity/product';
import type { StorefrontOperations } from '@shop/sdk/storefront';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { ProductPort } from '../public/ProductPort';

export class ProductGateway implements ProductPort {
  constructor(
    private readonly storefront: StorefrontOperations,
    private readonly context: RequestContextFactory
  ) {}
  async read(productId: string, signal?: AbortSignal): Promise<Product | null> {
    const items: ProductDto[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const value = await this.storefront.catalogRead({ query: { productId, limit: 50, ...(cursor ? { cursor } : {}) } }, this.context(null, { signal }));
      items.push(...value.items);
      if (!value.nextCursor) return mapProductDetail(items);
      cursor = value.nextCursor;
    }
    throw new Error('PRODUCT_SKU_PAGE_LIMIT_EXCEEDED');
  }
}
