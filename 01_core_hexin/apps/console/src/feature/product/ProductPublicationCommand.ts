import { createFetchCatalogListingsBatch, createFetchCatalogListingsPublish, createFetchCatalogListingsUnpublish } from '@shop/sdk/catalog';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ListingBatchPublicationReceiptSchema, ListingPublicationReceiptSchema, type Listing } from './ProductSchema';

const publishListing = createFetchCatalogListingsPublish(appConfig.apiBaseUrl);
const unpublishListing = createFetchCatalogListingsUnpublish(appConfig.apiBaseUrl);
const publishListingBatch = createFetchCatalogListingsBatch(appConfig.apiBaseUrl);

export type ListingPublicationAction = 'publish' | 'unpublish';

export function canManageListing(context: ConsoleContext, action: ListingPublicationAction): boolean {
  const operation = action === 'publish' ? 'catalog.listings.publish' : 'catalog.listings.unpublish';
  return context.scope.kind === 'mall'
    && context.session.csrf !== undefined
    && context.session.permissions.includes('catalog.listing.manage')
    && context.session.capabilities.includes(operation);
}

export function canPublishReadyListings(context: ConsoleContext): boolean {
  return context.scope.kind === 'mall'
    && context.session.csrf !== undefined
    && context.session.permissions.includes('catalog.listing.manage')
    && context.session.capabilities.includes('catalog.listings.batch');
}

export async function setListingPublication(
  context: ConsoleContext,
  listing: Listing,
  action: ListingPublicationAction,
  signal?: AbortSignal,
) {
  if (!canManageListing(context, action)) throw new Error('CATALOG_PUBLICATION_NOT_AVAILABLE');
  const request = consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    expectedVersion: listing.version,
    csrfToken: context.session.csrf!,
    idempotencyKey: `catalog-listing:${action}:${listing.id}:${listing.version}`,
    ...(signal === undefined ? {} : { signal }),
  });
  const input = { path: { listingid: listing.id }, body: {} };
  const value = action === 'publish' ? await publishListing(input, request) : await unpublishListing(input, request);
  return ListingPublicationReceiptSchema.parse(value);
}

export async function publishReadyListings(context: ConsoleContext, signal?: AbortSignal) {
  if (!canPublishReadyListings(context)) throw new Error('CATALOG_BATCH_PUBLICATION_NOT_AVAILABLE');
  const request = consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    csrfToken: context.session.csrf!,
    idempotencyKey: `catalog-listing:publish-ready:${context.scope.id}:${Date.now()}`,
    ...(signal === undefined ? {} : { signal }),
  });
  const value = await publishListingBatch({ body: { action: 'publish_ready' } }, request);
  return ListingBatchPublicationReceiptSchema.parse(value);
}
