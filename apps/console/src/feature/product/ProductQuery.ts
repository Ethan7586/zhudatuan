import type { OperationOutputFor } from '@shop/contract';
import { createFetchCatalogListingsRead, createFetchCatalogPoolsRead, createFetchCatalogProductDetailRead } from '@shop/sdk/catalog';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ListingPageSchema, PoolPageSchema } from './ProductSchema';

const listingsRead = createFetchCatalogListingsRead(appConfig.apiBaseUrl);
const productDetailRead = createFetchCatalogProductDetailRead(appConfig.apiBaseUrl);
const poolsRead = createFetchCatalogPoolsRead(appConfig.apiBaseUrl);

export type ProductDetail = OperationOutputFor<'catalog.product.detail.read'>;

export interface ProductQuery {
  readonly q?: string;
  readonly category?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export const productKey = (context: ConsoleContext, filter: ProductQuery) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'catalog.listings.read', filter.q ?? '', filter.category ?? '', filter.cursor ?? null, filter.limit ?? 50] as const);

export async function readProducts(context: ConsoleContext, filter: ProductQuery, signal: AbortSignal) {
  const value = await listingsRead(
    {
      query: {
        limit: filter.limit ?? 50,
        ...(filter.q === undefined || filter.q === '' ? {} : { q: filter.q }),
        ...(filter.category === undefined || filter.category === '' ? {} : { category: filter.category }),
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return ListingPageSchema.parse(value);
}

export const productDetailKey = (context: ConsoleContext, productId: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'catalog.product.detail.read', productId] as const);

export async function readProductDetail(context: ConsoleContext, productId: string, signal: AbortSignal): Promise<ProductDetail> {
  return productDetailRead({ path: { productid: productId } }, consoleRequest(context.scope, signal, context.session.accessVersion));
}

export const poolKey = (context: ConsoleContext) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'catalog.pools.read', 100] as const);

export async function readPools(context: ConsoleContext, signal: AbortSignal) {
  const value = await poolsRead({ query: { limit: 100 } }, consoleRequest(context.scope, signal, context.session.accessVersion));
  return PoolPageSchema.parse(value);
}
