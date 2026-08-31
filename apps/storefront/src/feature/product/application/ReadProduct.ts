import type { Product } from '../model/Product';
import { ProductGateway } from '../infrastructure/ProductGateway';
import { mapProduct } from '../../../shared/api/ProductMapper';

export class ReadProduct {
  async execute(productId: string, signal?: AbortSignal): Promise<Product | null> {
    const value = await ProductGateway.read(productId, signal);
    return value ? mapProduct(value) : null;
  }
}
