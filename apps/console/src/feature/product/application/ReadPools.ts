import type { ProductPort, ProductRequest } from '../public';

export class ReadPools {
  constructor(private readonly port: Pick<ProductPort, 'readPools'>) {}
  execute(request: ProductRequest, signal: AbortSignal) {
    return this.port.readPools(request, signal);
  }
}
