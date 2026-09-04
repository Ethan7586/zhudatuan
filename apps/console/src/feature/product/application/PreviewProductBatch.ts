import type { Listing, ProductBatchAction } from '../model/Product';
import type { ProductCommand, ProductPort } from '../public';

export class PreviewProductBatch {
  constructor(private readonly port: Pick<ProductPort, 'previewProductBatch'>) {}

  execute(request: ProductCommand, listings: readonly Listing[], action: ProductBatchAction) {
    validate(listings, request.identity);
    return this.port.previewProductBatch(request, listings, action);
  }
}

function validate(listings: readonly Listing[], identity: string): void {
  if (!identity || listings.length < 1 || listings.length > 200 || new Set(listings.map(({ id }) => id)).size !== listings.length) throw new Error('VALIDATION_FAILED');
}
