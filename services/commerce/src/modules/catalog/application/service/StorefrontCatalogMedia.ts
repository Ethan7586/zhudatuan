import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CatalogReadPort } from '../../public/CatalogReadPort';
import { productOutput } from './ProductOutput';
import type { ProductMedia } from './ProductMedia';

export class StorefrontCatalogMedia implements CatalogReadPort {
  constructor(
    private readonly catalog: CatalogReadPort,
    private readonly media: Pick<ProductMedia, 'links'>
  ) {}

  categories(context: ReadTransactionContext, input: Parameters<CatalogReadPort['categories']>[1]) {
    return this.catalog.categories(context, input);
  }

  async listings(context: ReadTransactionContext, input: Parameters<CatalogReadPort['listings']>[1]) {
    const page = await this.catalog.listings(context, input);
    const references = page.items.flatMap((item) => {
      const reference = item.attributes.coverObject;
      return typeof reference === 'string' && reference !== '' ? [reference] : [];
    });
    const links = await this.media.links(references);
    const items = page.items.map((item) => {
      const reference = item.attributes.coverObject;
      const coverUrl = typeof reference === 'string' ? (links.get(reference) ?? item.coverUrl) : item.coverUrl;
      return productOutput({ ...item, coverUrl });
    });
    return Object.freeze({ items: Object.freeze(items), next: page.next });
  }
}
