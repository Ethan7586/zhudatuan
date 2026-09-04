import type { ProductDetailSection } from '../model/Product';
import type { ProductPort, ProductRequest } from '../public';

export class ReadProduct {
  constructor(private readonly port: Pick<ProductPort, 'readProduct'>) {}
  execute(request: ProductRequest, productid: string, section: ProductDetailSection, signal?: AbortSignal) {
    return this.port.readProduct(request, productid, section, signal);
  }
}
