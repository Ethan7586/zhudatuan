import type { Listing, ProductBatch, ProductBatchAction } from '../model/Product';
import type { ProductCommand, ProductPort } from '../public';

export class ExecuteProductBatch {
  constructor(private readonly port: Pick<ProductPort, 'executeProductBatch'>) {}

  execute(request: ProductCommand, listings: readonly Listing[], action: ProductBatchAction, preview: ProductBatch) {
    if (
      !request.identity ||
      preview.phase !== 'preview' ||
      preview.action !== action ||
      !/^[0-9a-f]{64}$/.test(preview.previewHash) ||
      preview.count < 1 ||
      listings.length < 1 ||
      listings.length > 200 ||
      preview.items.length !== listings.length ||
      preview.items.some((item, index) => item.id !== listings[index]?.id)
    ) {
      throw new Error('VALIDATION_FAILED');
    }
    return this.port.executeProductBatch(request, listings, action, preview.previewHash);
  }
}
