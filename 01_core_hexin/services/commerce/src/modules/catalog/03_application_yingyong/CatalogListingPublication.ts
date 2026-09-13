import { randomUUID } from 'node:crypto';
import { rowResult, requireAccess, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../foundation/interface/Validation';
import { CATALOG_LISTING_MANAGEMENT_STATUS_SQL } from './CatalogListingManagement';

interface ListingIdRow extends Record<string, unknown> {
  readonly id: string;
}

interface PublicationJobRow extends Record<string, unknown> {
  readonly id: string;
  readonly kind: string;
  readonly scope_id: string;
  readonly state: string;
  readonly payload: unknown;
  readonly created_at: unknown;
  readonly updated_at: unknown;
}

interface PublicationFailure {
  readonly id: string;
  readonly sku_id: string | null;
  readonly title: string | null;
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

const SELECTED_STOREFRONT_POOL_CTE = `selected_pool as(
  select binding.pool_id from experience.binding binding
  join experience.application application on application.id=binding.application_id
    and application.status='active' and binding.domain=application.public_slug
  where binding.mall_id=$2 and exists(
    select 1 from experience.release release where release.application_id=application.id
      and release.state='active' and release.effective_at<=clock_timestamp()
      and (release.retired_at is null or release.retired_at>clock_timestamp())
  ) order by application.updated_at desc,application.id,binding.pool_id limit 1
)`;

export async function setListingPublication(
  request: OperationRequest,
  database: OperationDatabase,
  state: 'published' | 'unpublished',
) {
  const access = requireAccess(request);
  const expectedVersion = request.input.expectedVersion;
  if (expectedVersion === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
  const listing = request.input.path.listingid!;
  const result = await database.query(
    `with ${SELECTED_STOREFRONT_POOL_CTE}
    update catalog.listing set pool_id=case when $4='published'
        then coalesce(pool_id,(select pool_id from selected_pool)) else pool_id end,status=$4,
      effective_at=case when $4='published' then clock_timestamp() else effective_at end,
      expires_at=case when $4='unpublished' then clock_timestamp() else null end,
      version=version+1,updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and version=$3 returning *`,
    [listing, access.scope.id, expectedVersion, state],
  );
  if (result.rows[0]) return rowResult(result);
  const exists = await database.query('select version from catalog.listing where id=$1 and scope_id=$2', [listing, access.scope.id]);
  if (exists.rows[0]) throw new Error('VERSION_CONFLICT');
  throw new Error('RESOURCE_NOT_FOUND');
}

export async function setListingBatchPublication(request: OperationRequest, database: OperationDatabase) {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  if (body.action === 'select') {
    const ids = publicationIds(body.ids);
    const listingIds = ids.map(() => `listing:${randomUUID()}`);
    const result = await database.query(
      `with ${SELECTED_STOREFRONT_POOL_CTE},
      requested(source_id,listing_id) as(select * from unnest($1::text[],$3::text[]))
      insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version,created_at,updated_at)
      select requested.listing_id,$2,selected_pool.pool_id,source.sku_id,product.title,'draft',null,null,0,
        clock_timestamp(),clock_timestamp()
      from requested join catalog.sourcelisting source on source.id=requested.source_id
        and source.scope_id=$2 and source.status='mapped'
      join catalog.sku sku on sku.id=source.sku_id and sku.status='active'
      join catalog.product product on product.id=sku.product_id and product.status='active'
      cross join selected_pool
      on conflict(scope_id,sku_id) do nothing returning id,status,version`,
      [ids, access.scope.id, listingIds],
    );
    return { status: 200, body: { action: 'select', items: result.rows, count: result.rowCount } };
  }
  if (body.action === 'publish_ready') {
    const ids = body.ids === undefined
      ? (await database.query<ListingIdRow>(`select listing.id from catalog.listing listing
          join catalog.sku sku on sku.id=listing.sku_id join catalog.product product on product.id=sku.product_id
          where listing.scope_id=$1 and listing.status='draft'
            and (${CATALOG_LISTING_MANAGEMENT_STATUS_SQL})='pending_review'
          order by listing.id`, [access.scope.id])).rows.map(({ id }) => id)
      : publicationIds(body.ids);
    return queuePublication(database, access.scope.id, 'publish_ready', ids, undefined, request.input.idempotency);
  }
  if (body.action === 'retry_failed') {
    if (typeof body.id !== 'string' || !body.id.startsWith('catalogpublication:')) {
      throw new Error('VALIDATION_FAILED:id');
    }
    const original = await database.query<PublicationJobRow>(`select id,kind,scope_id,state,payload,created_at,updated_at from runtime.job
      where id=$1 and kind='catalogpublication' and owner='catalog' and scope_id=$2`, [body.id, access.scope.id]);
    const row = original.rows[0];
    if (!row) return { status: 404, body: { code: 'RESOURCE_NOT_FOUND' } };
    if (!['completed', 'failed', 'cancelled'].includes(row.state)) {
      return { status: 409, body: { code: 'CATALOG_PUBLICATION_RETRY_NOT_READY' } };
    }
    const ids = publicationFailures(row.payload).filter(({ retryable }) => retryable).map(({ id }) => id);
    if (ids.length === 0) return { status: 409, body: { code: 'CATALOG_PUBLICATION_RETRY_EMPTY' } };
    return queuePublication(database, access.scope.id, 'retry_failed', [...new Set(ids)], row.id, request.input.idempotency);
  }
  if (body.action !== 'publish' && body.action !== 'unpublish') throw new Error('VALIDATION_FAILED:action');
  if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string')) throw new Error('VALIDATION_FAILED:ids');
  const state = body.action === 'publish' ? 'published' : 'unpublished';
  const result = await database.query(
    `with ${SELECTED_STOREFRONT_POOL_CTE}
    update catalog.listing set pool_id=case when $3='published'
      then coalesce(pool_id,(select pool_id from selected_pool)) else pool_id end,
    status=$3,effective_at=case when $3='published' then clock_timestamp() else effective_at end,
    expires_at=case when $3='unpublished' then clock_timestamp() else null end,version=version+1,updated_at=clock_timestamp()
    where scope_id=$2 and id=any($1::text[]) returning id,status,version`,
    [body.ids, access.scope.id, state],
  );
  return { status: 200, body: { action: body.action, items: result.rows, count: result.rowCount } };
}

export function isCatalogPublicationReference(id: string | undefined): boolean {
  return id?.startsWith('catalogpublication:') ?? false;
}

export async function readListingPublicationStatus(request: OperationRequest, database: OperationDatabase) {
  const access = requireAccess(request);
  const reference = request.input.path.importid;
  if (!isCatalogPublicationReference(reference)) throw new Error('CATALOG_PUBLICATION_REFERENCE_INVALID');
  const latest = reference === 'catalogpublication:latest';
  const result = await database.query<PublicationJobRow>(`select id,kind,scope_id,state,payload,created_at,updated_at from runtime.job
    where kind='catalogpublication' and owner='catalog' and scope_id=$1 and ($2::text is null or id=$2)
    order by case when state in('queued','running') then 0 else 1 end,created_at desc,id desc limit 1`,
  [access.scope.id, latest ? null : reference]);
  const row = result.rows[0];
  if (!row) {
    return latest
      ? { status: 200, body: idlePublicationStatus() }
      : { status: 404, body: { code: 'RESOURCE_NOT_FOUND' } };
  }
  return { status: 200, body: publicationStatus(row) };
}

async function queuePublication(
  database: OperationDatabase,
  scope: string,
  action: 'publish_ready' | 'retry_failed',
  ids: readonly string[],
  parentId?: string,
  idempotencyKey?: string,
) {
  const id = `catalogpublication:${randomUUID()}`;
  const payload = {
    action,
    total: ids.length,
    processed: 0,
    succeeded: 0,
    published: 0,
    failed: 0,
    skipped: 0,
    phase: 'queued',
    target_ids: ids,
    failures: [],
    idempotency_key: idempotencyKey ?? null,
    ...(parentId === undefined ? {} : { parent_id: parentId }),
  };
  await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,'catalogpublication','catalog',$2,$3::jsonb,'queued',90,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
  [id, scope, JSON.stringify(payload)]);
  return { status: 202, body: { id, action, state: 'queued', items: [], count: ids.length,
    ...(parentId === undefined ? {} : { parent_id: parentId }) } };
}

function publicationIds(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 1_000
    || value.some((id) => typeof id !== 'string' || id.trim().length === 0 || id.length > 300)) {
    throw new Error('VALIDATION_FAILED:ids');
  }
  return [...new Set(value as string[])];
}

function publicationStatus(row: PublicationJobRow) {
  const payload = record(row.payload);
  const state = publicationState(row.state);
  const failures = publicationFailures(payload);
  const published = integer(payload.published ?? payload.succeeded);
  const failed = integer(payload.failed ?? failures.length);
  const persistedProcessed = integer(payload.processed ?? published + failed);
  const skipped = payload.succeeded === undefined
    ? Math.max(0, persistedProcessed - published - failed)
    : integer(payload.skipped);
  const processed = published + failed + skipped;
  const total = payload.total === undefined || payload.total === null ? null : integer(payload.total);
  if ((payload.succeeded !== undefined && persistedProcessed !== processed)
    || (total !== null && processed > total) || failures.length !== failed) {
    throw new Error('CATALOGPUBLICATION_PROGRESS_INVALID');
  }
  return {
    id: row.id,
    kind: row.kind,
    scope_id: row.scope_id,
    state,
    action: text(payload.action, 'publish_ready'),
    phase: text(payload.phase, row.state),
    total,
    processed,
    succeeded: published,
    published,
    failed,
    skipped,
    failures,
    retryable_count: failures.filter(({ retryable }) => retryable).length,
    parent_id: nullableText(payload.parent_id),
    idempotency_key: nullableText(payload.idempotency_key),
    started_at: nullableText(payload.started_at),
    completed_at: nullableText(payload.completed_at)
      ?? (state === 'completed' || state === 'failed' || state === 'cancelled' ? timestamp(row.updated_at) : null),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
  };
}

function idlePublicationStatus() {
  return { id: null, kind: 'catalogpublication', scope_id: null, state: 'idle', action: 'publish_ready', phase: 'idle', total: null, processed: 0,
    succeeded: 0, published: 0, failed: 0, skipped: 0, failures: [], retryable_count: 0,
    parent_id: null, idempotency_key: null, started_at: null, completed_at: null, created_at: null, updated_at: null };
}

function publicationFailures(value: unknown): readonly PublicationFailure[] {
  const failures = record(value).failures;
  if (!Array.isArray(failures)) return [];
  return failures.flatMap((item) => {
    const failure = record(item);
    const id = nullableText(failure.id);
    const code = nullableText(failure.code);
    const message = nullableText(failure.message);
    if (id === null || code === null || message === null) return [];
    return [{ id, sku_id: nullableText(failure.sku_id), title: nullableText(failure.title), code, message,
      retryable: failure.retryable === true }];
  });
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function integer(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('CATALOGPUBLICATION_PROGRESS_INVALID');
  return parsed;
}

function publicationState(value: string): 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' {
  return ['queued', 'running', 'completed', 'failed', 'cancelled'].includes(value)
    ? value as 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
    : 'failed';
}

function timestamp(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return nullableText(value);
}
