import type { ProductImport } from '../model/ProductImport';
import type { ProductCommand, ProductImportPort } from '../public';

export class ConfirmProductImport {
  constructor(private readonly port: Pick<ProductImportPort, 'confirmProductImport'>) {}
  execute(request: ProductCommand, task: ProductImport) {
    if (task.state !== 'ready' || !task.confirmationRequired || task.previewHash === null || task.validationErrors > 0) throw new Error('VALIDATION_FAILED');
    return this.port.confirmProductImport(request, task);
  }
}
