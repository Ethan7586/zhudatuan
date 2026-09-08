import { readFile } from 'node:fs/promises';
import type { QueryResult } from 'pg';
import { parseNodeManifest } from '@shop/config/server';
import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { assertCatalogNodeManifest, catalogOperatorRuntimeCompatibility } from './CatalogOperatorApiRuntime';

describe('catalog operator API runtime', () => {
  it('binds the catalog surface to the exact console origin and active production manifest', async () => {
    const path = new URL('../../../../../02_platform_pingtai/config/node-manifests/hbbtzn-l1.json', import.meta.url);
    const manifest = await parseNodeManifest(JSON.parse(await readFile(path, 'utf8')));
    expect(() => assertCatalogNodeManifest(manifest, ['https://console.hbbtzn.com'], 'test')).not.toThrow();
    expect(() => assertCatalogNodeManifest(manifest, ['https://console.zhudatuan.com'], 'test'))
      .toThrow('CATALOG_NODE_ORIGIN_MISMATCH');
    expect(() => assertCatalogNodeManifest(manifest, ['https://console.hbbtzn.com'], 'production')).not.toThrow();
  });

  it('requires the database role named by the node resource binding', async () => {
    const healthy = { current_user: 'hbbtzncatalogapi', writable: true, schema: true, contract: true,
      relations: true, functions: true, writes: true };
    const pool = (row: typeof healthy) => ({ query: async () => result([row]) }) as unknown as DatabasePool;
    await expect(catalogOperatorRuntimeCompatibility(pool(healthy), 'hbbtzncatalogapi')).resolves.toMatchObject(healthy);
    await expect(catalogOperatorRuntimeCompatibility(pool({ ...healthy, current_user: 'zhudatuanidentityapi' }), 'hbbtzncatalogapi'))
      .rejects.toThrow('CATALOG_OPERATOR_RUNTIME_COMPATIBILITY_FAILED');
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] };
}
