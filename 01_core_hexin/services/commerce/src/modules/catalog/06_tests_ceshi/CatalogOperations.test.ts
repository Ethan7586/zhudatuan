import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import type { AccessContext } from '../../../foundation/security/AccessContext';
import { confirmCatalogImport, createOrReuseCatalogImport } from '../03_application_yingyong/CatalogImportOperations';
import { catalogActions, setListingPublication } from '../03_application_yingyong/CatalogOperations';
import { readListingPublicationStatus, setListingBatchPublication } from '../03_application_yingyong/CatalogListingPublication';

describe('catalog mall command boundaries', () => {
  it('reuses a standard package by mall and sha without scheduling duplicate work', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.includes('from catalog.importjob where scope_id')
      ? [job('ready')] : []);
    const result = await createOrReuseCatalogImport(database, {
      kind: 'upload', access, reference: 'object:catalog-package', sha256: 'a'.repeat(64),
    });
    expect(result).toMatchObject({ status: 202, body: { id: 'catalogimport:1', state: 'ready', duplicate: true } });
    expect(calls.filter(({ text }) => text.includes('insert into runtime.job'))).toHaveLength(0);
    expect(calls[1]?.values).toEqual(['mall:hongtai', 'a'.repeat(64)]);
  });

  it('creates a new import with a PostgreSQL-typed runtime payload', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.startsWith('insert into catalog.importjob') ? [job('uploaded')] : []);
    const result = await createOrReuseCatalogImport(database, {
      kind: 'upload', access, reference: 'object:new-catalog-package', sha256: 'b'.repeat(64),
    });

    expect(result).toMatchObject({ status: 202, body: { state: 'uploaded', duplicate: false } });
    const scheduled = calls.find(({ text }) => text.includes('insert into runtime.job'));
    expect(scheduled?.text).toContain("jsonb_build_object('import',$3::text)");
    expect(scheduled?.values[1]).toBe('mall:hongtai');
    expect(scheduled?.values[2]).toMatch(/^catalogimport:/);
  });

  it('moves only an exact-mall ready import to running when the operator confirms', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.includes('from catalog.importjob where id=') ? [job('ready')]
      : text.includes("set state='running'") ? [job('running')] : []);
    const result = await confirmCatalogImport(database, { kind: 'confirm', access, importId: 'catalogimport:1' });

    expect(result).toMatchObject({ status: 202, body: { state: 'running', confirmed: true } });
    expect(calls.find(({ text }) => text.includes("set state='running'"))?.values).toEqual(['catalogimport:1', 'mall:hongtai']);
    expect(calls.find(({ text }) => text.includes('insert into runtime.job'))?.values).toEqual([
      'job:catalogimport:1:confirm', 'mall:hongtai', 'catalogimport:1',
    ]);
    expect(calls.find(({ text }) => text.includes('insert into runtime.job'))?.text)
      .toContain("jsonb_build_object('import',$3::text)");
  });

  it('reads and publishes listings only in the current Access Pipeline mall scope', async () => {
    const readCalls: QueryCall[] = [];
    const database = recordingDatabase(readCalls, (text) => text.includes('count(*) filter') ? [{
      total_count: 4,
      needs_attention: 1,
      pending_review: 1,
      published: 1,
      unpublished: 1,
    }] : []);
    const actions = catalogActions({ container: { get: () => ({}) } } as unknown as ModuleContext);
    const read = actions['catalog.listings.read'];
    if (typeof read !== 'function') throw new Error('CATALOG_LISTING_READ_ACTION_MISSING');
    const readResult = await read(request('catalog.listings.read', {}, undefined, { status: 'pending_review' }), database);
    const listingRead = readCalls.find(({ text }) => text.includes('from catalog.listing listing'))!;
    expect(listingRead.text).toContain('listing.scope_id=$1');
    expect(listingRead.text).not.toContain('organization.hierarchy');
    expect(listingRead.text).toContain('sku_count');
    expect(listingRead.text).toContain('management_status');
    expect(listingRead.text).toContain("then 'needs_attention'");
    expect(listingRead.values[0]).toBe('mall:hongtai');
    expect(listingRead.values[6]).toBe('pending_review');
    expect(readResult).toMatchObject({ body: {
      total_count: 4,
      status_counts: { needs_attention: 1, pending_review: 1, published: 1, unpublished: 1 },
    } });
    const summaryRead = readCalls.find(({ text }) => text.includes('count(*) filter'))!;
    expect(summaryRead.values).toEqual(['mall:hongtai', '', '', '', '']);

    const publishCalls: QueryCall[] = [];
    const publicationDatabase = recordingDatabase(publishCalls, (text) => text.startsWith('with selected_pool')
      ? [{ id: 'listing:1', status: 'published', version: 4 }] : []);
    await setListingPublication(request('catalog.listings.publish', { listingid: 'listing:1' }, 3), publicationDatabase, 'published');
    expect(publishCalls[0]?.text).toContain('where id=$1 and scope_id=$2 and version=$3');
    expect(publishCalls[0]?.text).toContain('experience.binding');
    expect(publishCalls[0]?.text).toContain('coalesce(pool_id,(select pool_id from selected_pool))');
    expect(publishCalls[0]?.values).toEqual(['listing:1', 'mall:hongtai', 3, 'published']);
  });

  it('queues ready draft publication for the current mall worker', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.startsWith('select listing.id')
      ? [{ id: 'listing:1' }, { id: 'listing:2' }] : []);

    const result = await setListingBatchPublication(
      request('catalog.listings.batch', {}, undefined, {}, { action: 'publish_ready' }),
      database,
    );

    expect(result).toMatchObject({ status: 202, body: { action: 'publish_ready', state: 'queued', count: 2 } });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.values).toEqual(['mall:hongtai']);
    expect(calls[1]?.values[1]).toBe('mall:hongtai');
    expect(calls[1]?.text).toContain("'catalogpublication'");
    expect(calls[1]?.text).toContain('insert into runtime.job');
    expect(JSON.parse(String(calls[1]?.values[2]))).toMatchObject({
      total: 2, processed: 0, target_ids: ['listing:1', 'listing:2'], failures: [],
    });
  });

  it('reads durable publication status only from the current mall scope', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, () => [{
      id: 'catalogpublication:1', kind: 'catalogpublication', scope_id: 'mall:hongtai', state: 'running',
      payload: { action: 'publish_ready', total: 3, processed: 2, published: 1, failed: 1, skipped: 0,
        failures: [{ id: 'listing:2', sku_id: 'sku:2', title: '商品二', code: 'STOREFRONT_POOL_MISSING',
          message: '商城缺少前台商品池', retryable: true }] },
      created_at: '2026-09-09T00:00:00.000Z', updated_at: '2026-09-09T00:00:01.000Z',
    }]);

    const result = await readListingPublicationStatus(
      request('catalog.imports.read', { importid: 'catalogpublication:1' }), database,
    );

    expect(calls[0]?.values).toEqual(['mall:hongtai', 'catalogpublication:1']);
    expect(result).toMatchObject({ status: 200, body: {
      id: 'catalogpublication:1', kind: 'catalogpublication', scope_id: 'mall:hongtai',
      state: 'running', total: 3, processed: 2, published: 1,
      failed: 1, retryable_count: 1,
    } });
  });

  it('queues a child task containing only retryable failed listings', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.startsWith('select id,kind,scope_id,state,payload') ? [{
      id: 'catalogpublication:old', kind: 'catalogpublication', scope_id: 'mall:hongtai',
      state: 'completed', created_at: '2026-09-09', updated_at: '2026-09-09',
      payload: { failures: [
        { id: 'listing:1', sku_id: 'sku:1', title: '一', code: 'LISTING_NOT_READY', message: '资料缺失', retryable: false },
        { id: 'listing:2', sku_id: 'sku:2', title: '二', code: 'LISTING_CHANGED', message: '状态变化', retryable: true },
      ] },
    }] : []);

    const result = await setListingBatchPublication(
      request('catalog.listings.batch', {}, undefined, {}, { action: 'retry_failed', id: 'catalogpublication:old' }), database,
    );

    expect(calls[0]?.values).toEqual(['catalogpublication:old', 'mall:hongtai']);
    expect(JSON.parse(String(calls[1]?.values[2]))).toMatchObject({
      action: 'retry_failed', target_ids: ['listing:2'], parent_id: 'catalogpublication:old', total: 1,
    });
    expect(result).toMatchObject({ status: 202, body: { action: 'retry_failed', count: 1,
      parent_id: 'catalogpublication:old' } });
  });

  it('assigns the active storefront pool during an explicit batch publication', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.startsWith('with selected_pool')
      ? [{ id: 'listing:1', status: 'published', version: 4 }] : []);

    const result = await setListingBatchPublication(
      request('catalog.listings.batch', {}, undefined, {}, { action: 'publish', ids: ['listing:1'] }),
      database,
    );

    expect(result).toMatchObject({ status: 200, body: { action: 'publish', count: 1 } });
    expect(calls[0]?.text).toContain('experience.binding');
    expect(calls[0]?.text).toContain('coalesce(pool_id,(select pool_id from selected_pool))');
    expect(calls[0]?.values).toEqual([['listing:1'], 'mall:hongtai', 'published']);
  });
});

interface QueryCall { readonly text: string; readonly values: readonly unknown[] }

function recordingDatabase(calls: QueryCall[], rowsFor: (text: string) => readonly Record<string, unknown>[]): OperationDatabase {
  return {
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      calls.push({ text, values });
      const rows = [...rowsFor(text)];
      return { rows, rowCount: rows.length } as unknown as QueryResult<Row>;
    },
  };
}

function job(state: string) {
  return { id: 'catalogimport:1', state, total_count: 1, cursor_value: 0, success_count: 0, failure_count: 0,
    created_at: '2026-09-07T00:00:00.000Z', updated_at: '2026-09-07T00:00:00.000Z' };
}

const access = {
  scope: { kind: 'mall', id: 'mall:hongtai' },
  actor: { target: 'console' },
} as unknown as AccessContext;

function request(
  type: OperationRequest['type'],
  path: Readonly<Record<string, string>> = {},
  expectedVersion?: number,
  query: Readonly<Record<string, string>> = {},
  body: Readonly<Record<string, unknown>> = {},
): OperationRequest {
  return {
    type,
    access,
    input: { path, query, headers: {}, body, rawBody: '{}', deadline: Date.now() + 1_000,
      signal: new AbortController().signal, ...(expectedVersion === undefined ? {} : { expectedVersion }) },
  };
}
