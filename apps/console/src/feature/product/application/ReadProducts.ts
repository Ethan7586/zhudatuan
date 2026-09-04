import type { ProductPort, ProductQuery, ProductRequest } from '../public';

export class ReadProducts {
  constructor(private readonly port: Pick<ProductPort, 'readProducts'>) {}
  execute(request: ProductRequest, query: ProductQuery, signal: AbortSignal) {
    return this.port.readProducts(request, query, signal);
  }
}
