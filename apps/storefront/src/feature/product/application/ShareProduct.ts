import type { Product } from '../model/Product';

export class ShareProduct {
  async execute(product: Product, url: string): Promise<'shared' | 'copied'> {
    if (navigator.share) {
      await navigator.share({ title: product.title, text: product.subtitle, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  }
}
