import type { Product } from '../../../entity/product';

export interface ProductPort {
  read(productId: string, signal?: AbortSignal): Promise<Product | null>;
}
