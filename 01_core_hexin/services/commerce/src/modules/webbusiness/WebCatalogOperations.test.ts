import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import type { AccessContext } from '../../foundation/security/AccessContext';
import { webCatalogActions } from './WebCatalogOperations';

describe('web catalog management read', () => {
  it('limits the ordinary first page before joining product details and summarizes draft readiness separately', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.includes('listing_counts') ? [{
      total_count: 571,
      needs_attention: 0,
      pending_review: 0,
      published: 571,
      unpublished: 0,
    }] : []);
    const read = webCatalogActions()['catalog.listings.read'];
    if (typeof read !== 'function') throw new Error('WEB_CATALOG_LISTING_READ_ACTION_MISSING');

    await read(request({}), database);

    const listingRead = calls[0]!;
    expect(listingRead.text).toContain('with listing_page as materialized');
    expect(listingRead.text.indexOf('limit $7')).toBeLessThan(listingRead.text.indexOf('join catalog.sku sku'));
    expect(listingRead.values).toEqual(['mall:hongtai', '', false, null, null, '', 51]);
    expect(calls[1]?.text).toContain('with scoped_listing as materialized');
    expect(calls[1]?.text).toContain("where listing.status='draft'");
    expect(calls[1]?.values).toEqual(['mall:hongtai', '', false]);
  });

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
    expect(summaryRead.text).toContain('with scoped_listing as materialized');
    expect(summaryRead.text).toContain('draft_classified as materialized');
    expect(summaryRead.text).toContain("filter(where status='published')");
    expect(summaryRead.text.match(/not exists\(select 1 from pricing\.pricebook/g)).toHaveLength(1);
    expect(summaryRead.values).toEqual(['mall:hongtai', '', false]);
    expect(calls.some(({ text }) => text.includes('console_supply_network'))).toBe(false);
  });

  it('returns the supply network through one projection query', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.includes('console_supply_network')
      ? [{ preview: { kind: 'console-product-v1', totalCount: 12 } }] : []);
    const read = webCatalogActions()['catalog.listings.read'];
    if (typeof read !== 'function') throw new Error('WEB_CATALOG_LISTING_READ_ACTION_MISSING');

    const result = await read(request({ view: 'supply-network' }), database);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.values).toEqual(['mall:hongtai']);
    expect(result).toMatchObject({ status: 200, body: {
      items: [], count: 0, preview: { kind: 'console-product-v1', totalCount: 12 },
    } });
  });

  it('returns mapped products for the console selection center', async () => {
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls, (text) => text.includes('from catalog.sourcelisting source') ? [{
      id: 'source:1', sku_id: 'sku:1', product_id: 'product:1', title: '候选商品', status: 'mapped',
      version: 0, cursor_sort: '2026-09-14T00:00:00.000Z', selection: { kind: 'selection-center-v1', selected: true },
    }] : []);
    const read = webCatalogActions()['catalog.listings.read'];
    if (typeof read !== 'function') throw new Error('WEB_CATALOG_LISTING_READ_ACTION_MISSING');

    const result = await read(request({ view: 'selection-center' }), database);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain("source.scope_id=$1 and source.status='mapped'");
    expect(calls[0]?.text).toContain("'kind','selection-center-v1'");
    expect(calls[0]?.values).toEqual(['mall:hongtai', '', '', '', '', '', null, null, 51]);
    expect(result).toMatchObject({ status: 200, body: { count: 1, items: [{ id: 'source:1' }] } });
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
