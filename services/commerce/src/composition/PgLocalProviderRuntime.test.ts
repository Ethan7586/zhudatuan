import { describe, expect, it, vi } from 'vitest';
import type { QueryResult } from 'pg';
import type { DatabasePool } from '../platform/database/Pool';
import { PgLocalProviderRuntime } from './PgLocalProviderRuntime';

describe('PostgreSQL local provider runtime', () => {
  it('injects the immutable scope and uses bounded typed parameters', async () => {
    const query = vi.fn(async () => result([{ payload: { records: [] } }]));
    const runtime = new PgLocalProviderRuntime(pool(query), ' mall-1 ', ' supplier ');

    await expect(runtime.invoke('channel.pull_supplier_stock', [[{ externalId: 'sku-1' }]])).resolves.toEqual({ records: [] });
    expect(runtime.scope).toBe('mall-1');
    expect(query).toHaveBeenCalledWith('select channel.pull_supplier_stock($1,$2::jsonb) as payload', ['mall-1', '[{"externalId":"sku-1"}]']);
  });

  it('rejects injected, cross-provider, missing and unbounded calls before querying', async () => {
    const query = vi.fn(async () => result([{ payload: {} }]));
    const runtime = new PgLocalProviderRuntime(pool(query), 'mall-1', 'supplier');

    await expect(runtime.invoke('channel.pull_supplier_catalog;drop table catalog.product', [])).rejects.toThrow('PROVIDER_LOCAL_OPERATION_INVALID');
    await expect(runtime.invoke('channel.pull_book_catalog', [])).rejects.toThrow('PROVIDER_LOCAL_OPERATION_FORBIDDEN');
    await expect(runtime.invoke('channel.pull_supplier_catalog', [undefined])).rejects.toThrow('PROVIDER_LOCAL_ARGUMENTS_INVALID');
    await expect(
      runtime.invoke(
        'channel.pull_supplier_catalog',
        Array.from({ length: 17 }, () => null)
      )
    ).rejects.toThrow('PROVIDER_LOCAL_ARGUMENTS_INVALID');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects non-JSON values, oversized values and missing database results', async () => {
    const query = vi.fn(async () => result([]));
    const runtime = new PgLocalProviderRuntime(pool(query), 'mall-1', 'supplier');
    await expect(runtime.invoke('channel.pull_supplier_catalog', [new Date()])).rejects.toThrow('PROVIDER_LOCAL_ARGUMENTS_INVALID');
    await expect(runtime.invoke('channel.pull_supplier_catalog', ['x'.repeat(1_048_577)])).rejects.toThrow('PROVIDER_LOCAL_ARGUMENTS_TOO_LARGE');
    await expect(runtime.invoke('channel.pull_supplier_catalog', [])).rejects.toThrow('PROVIDER_LOCAL_RESULT_MISSING');
  });
});

function pool(query: DatabasePool['query']): DatabasePool {
  const database: DatabasePool = {
    query,
    connect: async () => Promise.reject(new Error('not used')),
    workload: () => database,
    end: async () => undefined,
  };
  return database;
}

function result(rows: unknown[]): QueryResult {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] } as unknown as QueryResult;
}
