import type { Product } from '../../../entity/product';
import type { ShareOutcome, SharePort } from '../../../shared/platform/SharePort';

export class ShareProduct {
  constructor(private readonly share: SharePort) {}

  async execute(product: Product, url: string): Promise<ShareOutcome> {
    return this.share.share({ title: product.title, text: product.subtitle, url });
  }
}
