import type { OperationOutputFor } from '@shop/contract';
import { storefrontClient } from './Client';

export interface CatalogRequest {
  readonly cursor?: string;
  readonly limit?: number;
  readonly productId?: string;
  readonly listingIds?: readonly string[];
  readonly categoryId?: string;
  readonly account?: 'welfare' | 'meal' | 'wechat' | 'cash';
  readonly exclusive?: boolean;
  readonly query?: string;
}

export function readCatalog(request: CatalogRequest, signal?: AbortSignal): Promise<OperationOutputFor<'storefront.catalog.read'>> {
  return storefrontClient.commerce.storefront.catalogRead(
    {
      query: {
        ...(request.cursor ? { cursor: request.cursor } : {}),
        limit: Math.min(50, Math.max(1, request.limit ?? 50)),
        ...(request.productId ? { productId: request.productId } : {}),
        ...(request.listingIds?.length ? { listingIds: request.listingIds.join(',') } : {}),
        ...(request.categoryId ? { categoryId: request.categoryId } : {}),
        ...(request.account ? { account: request.account } : {}),
        ...(request.exclusive ? { exclusive: true } : {}),
        ...(request.query?.trim() ? { q: request.query.trim() } : {}),
      },
    },
    storefrontClient.context(null, { signal })
  );
}
