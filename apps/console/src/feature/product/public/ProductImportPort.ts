import type { ProductImport } from '../model/ProductImport';
import type { ProductCommand, ProductRequest } from './ProductPort';

export interface ProductImportPort {
  createProductImport(request: ProductCommand, file: File, progress?: (processed: number) => void): Promise<ProductImport>;
  readProductImport(request: ProductRequest, id: string, signal?: AbortSignal): Promise<ProductImport>;
  confirmProductImport(request: ProductCommand, task: ProductImport): Promise<ProductImport>;
}
