import type { Product } from '../../../entity/product';
import type { ProductPort } from '../public/ProductPort';

export class ReadProduct {
  constructor(private readonly gateway: Pick<ProductPort, 'read'>) {}
  async execute(productId: string, signal?: AbortSignal): Promise<Product | null> {
    return this.gateway.read(productId, signal);
  }
}
