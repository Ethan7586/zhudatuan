import type { ProductPort, ProductRequest } from '../public';

export class ReadFacets {
  constructor(private readonly port: Pick<ProductPort, 'readFacets'>) {}

  execute(request: ProductRequest, query: Readonly<{ q: string }>, signal: AbortSignal) {
    return this.port.readFacets(request, query, signal);
  }
}
