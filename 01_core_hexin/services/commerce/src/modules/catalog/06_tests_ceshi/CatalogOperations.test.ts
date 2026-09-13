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
    expect(summaryRead.text).toContain('with classified as materialized');
    expect(summaryRead.text).toContain("filter(where management_status='published')");
    expect(summaryRead.text.match(/not exists\(select 1 from pricing\.pricebook/g)).toHaveLength(1);
    expect(summaryRead.values).toEqual(['mall:hongtai', '', '', '', '']);
    expect(readCalls.some(({ text }) => text.includes('console_supply_network'))).toBe(false);

    const publishCalls: QueryCall[] = [];
    const publicationDatabase = recordingDatabase(publishCalls, (text) => text.startsWith('with selected_pool')
      ? [{ id: 'listing:1', status: 'published', version: 4 }] : []);
    await setListingPublication(request('catalog.listings.publish', { listingid: 'listing:1' }, 3), publicationDatabase, 'published');
    expect(publishCalls[0]?.text).toContain('where id=$1 and scope_id=$2 and version=$3');
    expect(publishCalls[0]?.text).toContain('experience.binding');
    expect(publishCalls[0]?.text).toContain('coalesce(pool_id,(select pool_id from selected_pool))');
    expect(publishCalls[0]?.values).toEqual(['listing:1', 'mall:hongtai', 3, 'published']);
  });

  it('reads the supply network without loading or summarizing catalog listings', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.includes('console_supply_network')
      ? [{ preview: { kind: 'console-product-v1', totalCount: 12 } }] : []);
    const actions = catalogActions({ container: { get: () => ({}) } } as unknown as ModuleContext);
    const read = actions['catalog.listings.read'];
    if (typeof read !== 'function') throw new Error('CATALOG_LISTING_READ_ACTION_MISSING');

    const result = await read(request('catalog.listings.read', {}, undefined, { view: 'supply-network' }), database);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain('console_supply_network');
    expect(calls[0]?.values).toEqual(['mall:hongtai']);
    expect(result).toMatchObject({ status: 200, body: {
      items: [], count: 0, preview: { kind: 'console-product-v1', totalCount: 12 },
    } });
  });

  it('reads the current mall selection pool from mapped supply products', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.includes('from catalog.sourcelisting source') ? [{
      id: 'source:1', sku_id: 'sku:1', product_id: 'product:1', title: '候选商品', status: 'mapped',
      version: 0, cursor_sort: '2026-09-14T00:00:00.000Z', selection: { kind: 'selection-center-v1', selected: false },
    }] : []);
    const actions = catalogActions({ container: { get: () => ({}) } } as unknown as ModuleContext);
    const read = actions['catalog.listings.read'];
    if (typeof read !== 'function') throw new Error('CATALOG_LISTING_READ_ACTION_MISSING');

    const result = await read(request('catalog.listings.read', {}, undefined, { view: 'selection-center', q: '候选' }), database);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain("source.scope_id=$1 and source.status='mapped'");
    expect(calls[0]?.text).toContain("'kind','selection-center-v1'");
    expect(calls[0]?.text).toContain("'selected',selected.id is not null");
    expect(calls[0]?.values).toEqual(['mall:hongtai', '候选', '', '', '', '', null, null, 51]);
    expect(result).toMatchObject({ status: 200, body: { count: 1, items: [{ id: 'source:1' }] } });
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
      idempotency_key: 'catalog-test-key',
    });
  });

  it('selects mapped source products into the active mall storefront pool', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.startsWith('with selected_pool')
      ? [{ id: 'listing:new', status: 'draft', version: 0 }] : []);

    const result = await setListingBatchPublication(
      request('catalog.listings.batch', {}, undefined, {}, { action: 'select', ids: ['source:1'] }),
      database,
    );

    expect(result).toMatchObject({ status: 200, body: { action: 'select', count: 1 } });
    expect(calls[0]?.text).toContain('from requested join catalog.sourcelisting source');
    expect(calls[0]?.text).toContain('on conflict(scope_id,sku_id) do nothing');
    expect(calls[0]?.values[0]).toEqual(['source:1']);
    expect(calls[0]?.values[1]).toBe('mall:hongtai');
    expect(calls[0]?.values[2]).toEqual([expect.stringMatching(/^listing:/)]);
  });

  it('reads durable publication status only from the current mall scope', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, () => [{
      id: 'catalogpublication:1', kind: 'catalogpublication', scope_id: 'mall:hongtai', state: 'running',
      payload: { action: 'publish_ready', total: 3, processed: 2, published: 1, failed: 1, skipped: 0,
        idempotency_key: 'catalog-test-key',
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
      failed: 1, retryable_count: 1, idempotency_key: 'catalog-test-key',
    } });
  });

  it('returns a server completion time for a terminal task even when the worker stopped before writing one', async () => {
    const database = recordingDatabase([], () => [{
      id: 'catalogpublication:failed', kind: 'catalogpublication', scope_id: 'mall:hongtai', state: 'failed',
      payload: { action: 'publish_ready', total: 1, processed: 0, succeeded: 0, failed: 0, skipped: 0, failures: [] },
      created_at: '2026-09-09T00:00:00.000Z', updated_at: '2026-09-09T00:00:05.000Z',
    }]);

    const result = await readListingPublicationStatus(
      request('catalog.imports.read', { importid: 'catalogpublication:failed' }), database,
    );

    expect(result).toMatchObject({ status: 200, body: {
      state: 'failed', completed_at: '2026-09-09T00:00:05.000Z',
    } });
  });

  it('discovers the active task before the most recent terminal task for the current mall', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, () => [{
      id: 'catalogpublication:active', kind: 'catalogpublication', scope_id: 'mall:hongtai', state: 'queued',
      payload: { action: 'publish_ready', total: 2, processed: 0, succeeded: 0, failed: 0, skipped: 0,
        failures: [], idempotency_key: 'catalog-active-key' },
      created_at: '2026-09-09T00:00:00.000Z', updated_at: '2026-09-09T00:00:00.000Z',
    }]);

    const result = await readListingPublicationStatus(
      request('catalog.imports.read', { importid: 'catalogpublication:latest' }), database,
    );

    expect(calls[0]?.values).toEqual(['mall:hongtai', null]);
    expect(calls[0]?.text).toContain("case when state in('queued','running') then 0 else 1 end");
    expect(result).toMatchObject({ status: 200, body: {
      id: 'catalogpublication:active', state: 'queued', idempotency_key: 'catalog-active-key',
    } });
  });

  it('rejects malformed persisted counters instead of reporting invented progress', async () => {
    const database = recordingDatabase([], () => [{
      id: 'catalogpublication:invalid', kind: 'catalogpublication', scope_id: 'mall:hongtai', state: 'running',
      payload: { action: 'publish_ready', total: 1, processed: 'not-a-number', succeeded: 0,
        failed: 0, skipped: 0, failures: [] },
      created_at: '2026-09-09T00:00:00.000Z', updated_at: '2026-09-09T00:00:01.000Z',
    }]);

    await expect(readListingPublicationStatus(
      request('catalog.imports.read', { importid: 'catalogpublication:invalid' }), database,
    )).rejects.toThrow('CATALOGPUBLICATION_PROGRESS_INVALID');
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
      idempotency_key: 'catalog-test-key',
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
      signal: new AbortController().signal, idempotency: 'catalog-test-key',
      ...(expectedVersion === undefined ? {} : { expectedVersion }) },
  };
}
