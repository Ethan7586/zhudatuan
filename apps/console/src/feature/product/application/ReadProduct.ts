import type { ProductPort, ProductRequest } from '../public';

export class ReadProduct {
  constructor(private readonly port: Pick<ProductPort, 'readProduct'>) {}
  execute(request: ProductRequest, productid: string, signal?: AbortSignal) {
    return this.port.readProduct(request, productid, signal);
  }
}
