import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import type { AccessContext } from '../../../foundation/security/AccessContext';
import { confirmCatalogImport, createOrReuseCatalogImport } from '../03_application_yingyong/CatalogImportOperations';
import { catalogActions, setListingPublication } from '../03_application_yingyong/CatalogOperations';

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
  });

  it('reads and publishes listings only in the current Access Pipeline mall scope', async () => {
    const readCalls: QueryCall[] = [];
    const database = recordingDatabase(readCalls, () => []);
    const actions = catalogActions({ container: { get: () => ({}) } } as unknown as ModuleContext);
    const read = actions['catalog.listings.read'];
    if (typeof read !== 'function') throw new Error('CATALOG_LISTING_READ_ACTION_MISSING');
    await read(request('catalog.listings.read'), database);
    const listingRead = readCalls.find(({ text }) => text.includes('from catalog.listing listing'))!;
    expect(listingRead.text).toContain('listing.scope_id=$1');
    expect(listingRead.text).not.toContain('organization.hierarchy');
    expect(listingRead.values[0]).toBe('mall:hongtai');

    const publishCalls: QueryCall[] = [];
    const publicationDatabase = recordingDatabase(publishCalls, (text) => text.startsWith('update catalog.listing')
      ? [{ id: 'listing:1', status: 'published', version: 4 }] : []);
    await setListingPublication(request('catalog.listings.publish', { listingid: 'listing:1' }, 3), publicationDatabase, 'published');
    expect(publishCalls[0]?.text).toContain('where id=$1 and scope_id=$2 and version=$3');
    expect(publishCalls[0]?.values).toEqual(['listing:1', 'mall:hongtai', 3, 'published']);
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

function request(type: OperationRequest['type'], path: Readonly<Record<string, string>> = {}, expectedVersion?: number): OperationRequest {
  return {
    type,
    access,
    input: { path, query: {}, headers: {}, body: {}, rawBody: '{}', deadline: Date.now() + 1_000,
      signal: new AbortController().signal, ...(expectedVersion === undefined ? {} : { expectedVersion }) },
  };
}
