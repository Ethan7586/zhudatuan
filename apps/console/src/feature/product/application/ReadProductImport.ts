import type { ProductRequest, ProductImportPort } from '../public';

export class ReadProductImport {
  constructor(private readonly port: Pick<ProductImportPort, 'readProductImport'>) {}
  execute(request: ProductRequest, id: string, signal?: AbortSignal) {
    if (id.length === 0) throw new Error('VALIDATION_FAILED');
    return this.port.readProductImport(request, id, signal);
  }
}
