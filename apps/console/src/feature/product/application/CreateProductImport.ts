import type { ProductImport } from '../model/ProductImport';
import type { ProductCommand, ProductImportPort } from '../public';

export class CreateProductImport {
  constructor(private readonly port: Pick<ProductImportPort, 'createProductImport'>) {}

  execute(request: ProductCommand, file: File | null, progress?: (processed: number) => void): Promise<ProductImport> {
    if (file === null || request.identity.length === 0) throw new Error('VALIDATION_FAILED');
    return this.port.createProductImport(request, file, progress);
  }
}
