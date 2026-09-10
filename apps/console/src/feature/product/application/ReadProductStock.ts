import type { ProductPort, ProductRequest } from '../public';

export class ReadProductStock {
  constructor(private readonly port: Pick<ProductPort, 'readStock'>) {}

  execute(request: ProductRequest, sku: string, signal?: AbortSignal) {
    if (sku.trim().length === 0) throw new Error('PRODUCT_SKU_REQUIRED');
    return this.port.readStock(request, sku, signal);
  }
}
