import type { OperationOutputFor } from '@shop/contract';
import type { ListingPage, PoolPage, ProductDetail, ProductReceipt } from '../model/Product';
import { deepFreeze } from '../../../shared/model/Immutable';
import { ListingPageSchema, PoolPageSchema } from './ProductDto';

export class ProductMapper {
  page(value: unknown): ListingPage {
    const page = ListingPageSchema.parse(value);
    return Object.freeze({ ...page, items: Object.freeze(page.items.map((item) => Object.freeze(item))) });
  }

  pools(value: unknown): PoolPage {
    const page = PoolPageSchema.parse(value);
    return Object.freeze({ ...page, items: Object.freeze(page.items.map((item) => Object.freeze(item))) });
  }

  detail(value: OperationOutputFor<'catalog.product.detail.read'>): ProductDetail {
    return deepFreeze(structuredClone(value));
  }

  receipt(value: unknown): ProductReceipt {
    if (typeof value !== 'object' || value === null) return Object.freeze({});
    const candidate = value as { id?: unknown; count?: unknown; version?: unknown };
    return Object.freeze({ ...(typeof candidate.id === 'string' ? { id: candidate.id } : {}), ...(typeof candidate.count === 'number' ? { count: candidate.count } : {}), ...(typeof candidate.version === 'string' || typeof candidate.version === 'number' ? { version: Number(candidate.version) } : {}) });
  }
}
