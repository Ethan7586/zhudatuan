import type { Listing } from '../model/Product';
import type { ProductCommand, ProductPort } from '../public';

export class ChangePublication {
  constructor(private readonly port: Pick<ProductPort, 'changePublication'>) {}
  execute(request: ProductCommand, listings: readonly Listing[], published: boolean) {
    if (listings.length !== 1) throw new Error('PRODUCT_SELECTION_REQUIRED');
    return this.port.changePublication(request, listings, published);
  }
}
