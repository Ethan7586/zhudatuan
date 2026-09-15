import { createFetchCatalogListingsRead } from '@shop/sdk/catalog';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consumeDocumentPrefetch } from '../../shared/api/DocumentPrefetch';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ListingPageSchema } from './ProductSchema';

const listingsRead = createFetchCatalogListingsRead(appConfig.apiBaseUrl);
export const PRODUCT_CATALOG_DEFAULT_PAGE_LIMIT = 20;

export interface ProductQuery {
  readonly q: string;
  readonly category: string;
  readonly supplier?: string;
  readonly mall?: string;
  readonly status?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly preview?: boolean;
  readonly view?: 'supply-network' | 'selection-center';
  readonly selection?: 'available' | 'selected';
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
    filter.limit ?? PRODUCT_CATALOG_DEFAULT_PAGE_LIMIT,
    filter.preview ?? false,
    filter.view ?? '',
    filter.selection ?? '',
  ] as const);

export async function readProducts(context: ConsoleContext, filter: ProductQuery, signal: AbortSignal) {
  const prefetched = await takeDocumentProductPrefetch(context, filter, signal);
  if (prefetched !== undefined) return prefetched;
  const value = await listingsRead(
    {
      query: {
        limit: filter.limit ?? PRODUCT_CATALOG_DEFAULT_PAGE_LIMIT,
        ...(filter.q === '' ? {} : { q: filter.q }),
        ...(filter.category === '' ? {} : { category: filter.category }),
        ...(filter.preview && filter.supplier !== undefined && filter.supplier !== '' ? { supplier: filter.supplier } : {}),
        ...(filter.preview && filter.mall !== undefined && filter.mall !== '' ? { mall: filter.mall } : {}),
        ...(filter.status !== undefined && filter.status !== '' ? { status: filter.status } : {}),
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
        ...(filter.view === undefined ? {} : { view: filter.view }),
        ...(filter.selection === undefined ? {} : { selection: filter.selection }),
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return ListingPageSchema.parse(value);
}

async function takeDocumentProductPrefetch(
  context: ConsoleContext,
  filter: ProductQuery,
  signal: AbortSignal,
) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleProductPrefetch;
  delete window.__consoleProductPrefetch;
  const value = await consumeDocumentPrefetch(slot, signal);
  const query = value?.query;
  const matches = value?.scopeKind === context.scope.kind
    && value.scopeId === context.scope.id
    && value.accessVersion === context.session.accessVersion
    && query?.q === filter.q
    && query.category === filter.category
    && query.supplier === (filter.supplier ?? '')
    && query.mall === (filter.mall ?? '')
    && query.status === (filter.status ?? '')
    && query.cursor === filter.cursor
    && query.limit === (filter.limit ?? 50)
    && query.preview === (filter.preview ?? false)
    && query.view === filter.view
    && query.selection === filter.selection;
  if (!matches) return undefined;
  const parsed = ListingPageSchema.safeParse(value.value);
  return parsed.success ? parsed.data : undefined;
}
