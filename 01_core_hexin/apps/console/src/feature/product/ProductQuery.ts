import { createFetchCatalogListingsRead } from '@shop/sdk/catalog';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ListingPageSchema } from './ProductSchema';

const listingsRead = createFetchCatalogListingsRead(appConfig.apiBaseUrl);

export interface ProductQuery {
  readonly q: string;
  readonly category: string;
  readonly supplier?: string;
  readonly mall?: string;
  readonly status?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly preview?: boolean;
  readonly view?: 'supply-network';
}

export const productKey = (context: ConsoleContext, filter: ProductQuery) =>
  Object.freeze([
    'console',
    context.scope.kind,
    context.scope.id,
    context.session.accessVersion,
    'catalog.listings.read',
    filter.q,
    filter.category,
    filter.supplier ?? '',
    filter.mall ?? '',
    filter.status ?? '',
    filter.cursor ?? null,
    filter.limit ?? 50,
    filter.preview ?? false,
    filter.view ?? '',
  ] as const);

export async function readProducts(context: ConsoleContext, filter: ProductQuery, signal: AbortSignal) {
  const value = await listingsRead(
    {
      query: {
        limit: filter.limit ?? 50,
        ...(filter.q === '' ? {} : { q: filter.q }),
        ...(filter.category === '' ? {} : { category: filter.category }),
        ...(filter.preview && filter.supplier !== undefined && filter.supplier !== '' ? { supplier: filter.supplier } : {}),
        ...(filter.preview && filter.mall !== undefined && filter.mall !== '' ? { mall: filter.mall } : {}),
        ...(filter.status !== undefined && filter.status !== '' ? { status: filter.status } : {}),
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
        ...(filter.view === undefined ? {} : { view: filter.view }),
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return ListingPageSchema.parse(value);
}
