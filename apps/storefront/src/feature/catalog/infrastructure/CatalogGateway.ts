import type { StorefrontOperations } from '@shop/sdk/storefront';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { CatalogFilter } from '../model/CatalogFilter';
import type { CatalogPage } from '../model/CatalogPage';
import { mapCatalog } from './CatalogMapper';
import type { CatalogPort } from '../public/CatalogPort';

export class CatalogGateway implements CatalogPort {
  constructor(
    private readonly storefront: StorefrontOperations,
    private readonly context: RequestContextFactory
  ) {}
  async read(filter: CatalogFilter, signal?: AbortSignal): Promise<CatalogPage> {
    const { listingIds, query, ...rest } = filter;
    return mapCatalog(
      await this.storefront.catalogRead(
        {
          query: {
            ...rest,
            ...(listingIds?.length ? { listingIds: [...new Set(listingIds)].join(',') } : {}),
            ...(query ? { q: query } : {}),
          },
        },
        this.context(null, { signal })
      )
    );
  }
}
