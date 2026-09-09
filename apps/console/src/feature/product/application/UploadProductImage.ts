import type { ProductImageProgress } from '../model/Product';
import type { ProductCommand, ProductPort } from '../public';

export class UploadProductImage {
  constructor(private readonly port: ProductPort) {}

  execute(request: ProductCommand, file: File, signal?: AbortSignal, progress?: (value: ProductImageProgress) => void) {
    return this.port.uploadProductImage(request, file, signal, progress);
  }
}
