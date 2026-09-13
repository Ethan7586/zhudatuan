import { createFetchCatalogListingsBatch } from '@shop/sdk/catalog';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ProductSelectionReceiptSchema } from './ProductSchema';

const selectListings = createFetchCatalogListingsBatch(appConfig.apiBaseUrl);

export function canSelectProducts(context: ConsoleContext): boolean {
  return context.scope.kind === 'mall'
    && context.session.csrf !== undefined
    && context.session.permissions.includes('catalog.listing.manage')
    && context.session.capabilities.includes('catalog.listings.batch');
}

export async function selectProducts(context: ConsoleContext, sourceIds: readonly string[], signal?: AbortSignal) {
  if (!canSelectProducts(context) || sourceIds.length === 0) throw new Error('CATALOG_SELECTION_NOT_AVAILABLE');
  const value = await selectListings(
    { body: { action: 'select', ids: [...new Set(sourceIds)] } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken: context.session.csrf!,
      idempotencyKey: `catalog-selection:${context.scope.id}:${Date.now()}`,
      ...(signal === undefined ? {} : { signal }),
    }),
  );
  return ProductSelectionReceiptSchema.parse(value);
}
