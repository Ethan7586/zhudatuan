import type { OperationOutputFor } from '@shop/contract';
import type { CategoryPage, ListingPage, PoolPage, ProductBatch, ProductDetail, ProductFacets } from '../model/Product';
import type { ProductImport } from '../model/ProductImport';
import { deepFreeze } from '../../../shared/model/Immutable';

export class ProductMapper {
  page(value: OperationOutputFor<'catalog.listings.read'>): ListingPage {
    return deepFreeze(structuredClone(value));
  }

  pools(value: OperationOutputFor<'catalog.pools.read'>): PoolPage {
    return deepFreeze(structuredClone(value));
  }

  categories(value: OperationOutputFor<'catalog.categories.read'>): CategoryPage {
    return deepFreeze(structuredClone(value));
  }

  detail(value: OperationOutputFor<'catalog.product.detail.read'>): ProductDetail {
    return deepFreeze(structuredClone(value));
  }

  facets(value: OperationOutputFor<'catalog.facets.read'>): ProductFacets {
    return deepFreeze(structuredClone(value));
  }

  batch(value: OperationOutputFor<'catalog.listings.batch'>): ProductBatch {
    return deepFreeze(structuredClone(value));
  }

  importTask(value: OperationOutputFor<'runtime.imports.read'>, detail?: OperationOutputFor<'catalog.imports.read'>): ProductImport {
    return deepFreeze({
      ...structuredClone(value),
      last_error: detail?.last_error ?? null,
      errors: detail?.errors ?? [],
      ...(detail?.report === undefined ? {} : { report: { ...detail.report } }),
    });
  }
}
