import type { ProductPort, ProductRequest } from '../public';

export class ReadCategories {
  constructor(private readonly port: Pick<ProductPort, 'readCategories'>) {}

  execute(request: ProductRequest, signal: AbortSignal) {
    return this.port.readCategories(request, signal);
  }
}
