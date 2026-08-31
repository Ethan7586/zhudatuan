import type { OperationOutputFor } from '@shop/contract';
import { readCatalog } from '../../../shared/api/CatalogClient';
import type { CatalogFilter } from '../model/CatalogFilter';

export const CatalogGateway = Object.freeze({
  read(filter: CatalogFilter, signal?: AbortSignal): Promise<OperationOutputFor<'storefront.catalog.read'>> {
    return readCatalog(filter, signal);
  },
});
