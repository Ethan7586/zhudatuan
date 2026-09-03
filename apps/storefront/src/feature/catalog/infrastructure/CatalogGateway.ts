import type { OperationOutputFor } from '@shop/contract';
import type { StorefrontClient } from '../../../shared/api/Client';
import type { CatalogFilter } from '../model/CatalogFilter';

export class CatalogGateway {
  constructor(private readonly storefront: StorefrontClient['commerce']['storefront'], private readonly context: StorefrontClient['context']) {}
  read(filter: CatalogFilter, signal?: AbortSignal): Promise<OperationOutputFor<'storefront.catalog.read'>> {
    return this.storefront.catalogRead({ query: { ...filter } }, this.context(null, { signal }));
  }
}
