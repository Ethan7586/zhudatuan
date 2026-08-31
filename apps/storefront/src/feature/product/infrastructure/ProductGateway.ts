import { readCatalog } from '../../../shared/api/CatalogClient';
import type { ProductDto } from '../../../shared/api/ProductMapper';

export const ProductGateway = Object.freeze({
  async read(productId: string, signal?: AbortSignal): Promise<ProductDto | null> {
    const value = await readCatalog({ productId, limit: 1 }, signal);
    return value.items[0] ?? null;
  },
});
