import { createFetchCatalogImportsRead, createFetchCatalogListingsBatch, createFetchCatalogListingsPublish,
  createFetchCatalogListingsUnpublish } from '@shop/sdk/catalog';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { CatalogPublicationTaskSchema, ListingBatchPublicationReceiptSchema, ListingPublicationReceiptSchema,
  type CatalogPublicationTask, type Listing } from './ProductSchema';

const publishListing = createFetchCatalogListingsPublish(appConfig.apiBaseUrl);
const unpublishListing = createFetchCatalogListingsUnpublish(appConfig.apiBaseUrl);
const publishListingBatch = createFetchCatalogListingsBatch(appConfig.apiBaseUrl);
const readCatalogImport = createFetchCatalogImportsRead(appConfig.apiBaseUrl);

export type ListingPublicationAction = 'publish' | 'unpublish';

export function canManageListing(context: ConsoleContext, action: ListingPublicationAction): boolean {
  const operation = action === 'publish' ? 'catalog.listings.publish' : 'catalog.listings.unpublish';
  return context.scope.kind === 'mall'
    && context.session.csrf !== undefined
    && context.session.permissions.includes('catalog.listing.manage')
    && context.session.capabilities.includes(operation);
}

export function canPublishReadyListings(context: ConsoleContext): boolean {
  return readyPublicationUnavailableReason(context) === undefined;
}

export function readyPublicationUnavailableReason(context: ConsoleContext): string | undefined {
  if (context.scope.kind !== 'mall') return '请先切换到商城范围';
  if (context.session.csrf === undefined) return '登录状态缺少操作凭证，请重新登录';
  if (!context.session.permissions.includes('catalog.listing.manage')) return '当前账号缺少商品上架权限';
  if (!context.session.capabilities.includes('catalog.listings.batch')) return '当前角色未开通批量审核上架能力';
  if (!context.session.permissions.includes('catalog.import.read')
    || !context.session.capabilities.includes('catalog.imports.read')) return '当前角色未开通发布任务状态读取能力';
  return undefined;
}

export function canReadPublicationTask(context: ConsoleContext): boolean {
  return context.scope.kind === 'mall'
    && context.session.permissions.includes('catalog.import.read')
    && context.session.capabilities.includes('catalog.imports.read');
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

export async function readPublicationTask(
  context: ConsoleContext,
  id: string = 'catalogpublication:latest',
  signal?: AbortSignal,
): Promise<CatalogPublicationTask> {
  if (!canReadPublicationTask(context)) throw new Error('CATALOG_PUBLICATION_STATUS_NOT_AVAILABLE');
  try {
    const value = await readCatalogImport(
      { path: { importid: id } },
      consoleRequest(context.scope, signal, context.session.accessVersion),
    );
    return CatalogPublicationTaskSchema.parse(value);
  } catch (error) {
    if (isMissingPublicationTask(error)) return idlePublicationTask();
    throw error;
  }
}

function isMissingPublicationTask(error: unknown): boolean {
  const candidate = error as Readonly<{ status?: unknown }>;
  return candidate.status === 404;
}

function idlePublicationTask(): CatalogPublicationTask {
  return {
    id: null,
    kind: 'catalogpublication',
    scope_id: null,
    state: 'idle',
    action: 'publish_ready',
    phase: 'idle',
    total: null,
    processed: 0,
    succeeded: 0,
    published: 0,
    failed: 0,
    skipped: 0,
    failures: [],
    retryable_count: 0,
    parent_id: null,
    started_at: null,
    created_at: null,
    updated_at: null,
    completed_at: null,
  };
}

export async function retryPublicationFailures(
  context: ConsoleContext,
  task: CatalogPublicationTask,
  signal?: AbortSignal,
) {
  if (!canPublishReadyListings(context) || task.id === null || task.retryable_count === 0) {
    throw new Error('CATALOG_PUBLICATION_RETRY_NOT_AVAILABLE');
  }
  const value = await publishListingBatch(
    { body: { action: 'retry_failed', id: task.id } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken: context.session.csrf!,
      idempotencyKey: `catalog-listing:retry-failed:${task.id}`,
      ...(signal === undefined ? {} : { signal }),
    }),
  );
  return ListingBatchPublicationReceiptSchema.parse(value);
}
