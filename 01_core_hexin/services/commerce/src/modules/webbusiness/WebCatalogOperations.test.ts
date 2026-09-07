import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import type { AccessContext } from '../../foundation/security/AccessContext';
import { webCatalogActions } from './WebCatalogOperations';

describe('web catalog management read', () => {
  it('returns SKU quantity and management status totals through the hierarchy-aware path', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.includes('count(*) filter') ? [{
      total_count: 12,
      needs_attention: 2,
      pending_review: 7,
      published: 1,
      unpublished: 2,
    }] : []);
    const read = webCatalogActions()['catalog.listings.read'];
    if (typeof read !== 'function') throw new Error('WEB_CATALOG_LISTING_READ_ACTION_MISSING');

    const result = await read(request({ status: 'needs_attention' }), database);
    const listingRead = calls.find(({ text }) => text.includes('from catalog.listing listing'))!;
    expect(listingRead.text).toContain('organization.unitclosure');
    expect(listingRead.text).toContain('sku_count');
    expect(listingRead.text).toContain('management_status');
    expect(listingRead.values[6]).toBe('needs_attention');
    expect(listingRead.values[10]).toBe(false);
    expect(result).toMatchObject({ body: {
      total_count: 12,
      status_counts: { needs_attention: 2, pending_review: 7, published: 1, unpublished: 2 },
    } });

    const summaryRead = calls.find(({ text }) => text.includes('count(*) filter'))!;
    expect(summaryRead.text).toContain('organization.unitclosure');
    expect(summaryRead.values).toEqual(['mall:hongtai', '', '', '', '', false]);
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

function request(query: Readonly<Record<string, string>>): OperationRequest {
  return {
    type: 'catalog.listings.read',
    access: {
      scope: { kind: 'mall', id: 'mall:hongtai' },
      actor: { target: 'console' },
    } as unknown as AccessContext,
    input: {
      path: {},
      query,
      headers: {},
      body: {},
      rawBody: '{}',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
    },
  };
}
