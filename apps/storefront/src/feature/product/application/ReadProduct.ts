import type { Product } from '../../../entity/product';
import { ProductGateway } from '../infrastructure/ProductGateway';
import { mapProduct } from '../../../entity/product';

export class ReadProduct {
  constructor(private readonly gateway: Pick<ProductGateway, 'read'>) {}
  async execute(productId: string, signal?: AbortSignal): Promise<Product | null> {
    const value = await this.gateway.read(productId, signal);
    return value ? mapProduct(value) : null;
  }
}
