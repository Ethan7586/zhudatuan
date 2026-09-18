import { readFile } from 'node:fs/promises';
import type { QueryResult } from 'pg';
import { parseNodeManifest } from '@shop/config/server';
import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { assertCatalogNodeManifest, bindCatalogOperatorNodeManifest, catalogOperatorRuntimeCompatibility } from './CatalogOperatorApiRuntime';
import { createNodeContextResolver } from '@shop/config/sfl-node-kernel';
import { NODE_MANIFEST_REGISTRY } from './ApiBootstrap';
import { Container } from './Container';

describe('catalog operator API runtime', () => {
  it('binds the catalog surface to the exact console origin and active production manifest', async () => {
    const path = new URL('../../../../../02_platform_pingtai/config/node-manifests/hbbtzn-l1.json', import.meta.url);
    const manifest = await parseNodeManifest(JSON.parse(await readFile(path, 'utf8')));
    expect(() => assertCatalogNodeManifest(manifest, ['https://console.fufuwang.com.cn'], 'test')).not.toThrow();
    expect(() => assertCatalogNodeManifest(manifest, ['https://console.zhudatuan.com'], 'test'))
      .toThrow('CATALOG_NODE_ORIGIN_MISMATCH');
    expect(() => assertCatalogNodeManifest(manifest, ['https://console.fufuwang.com.cn'], 'production')).not.toThrow();
  });

  it('installs the loaded L1 manifest as the request node-context source', async () => {
    const path = new URL('../../../../../02_platform_pingtai/config/node-manifests/hbbtzn-l1.json', import.meta.url);
    const manifest = await parseNodeManifest(JSON.parse(await readFile(path, 'utf8')));
    const container = new Container();
    bindCatalogOperatorNodeManifest(container, manifest);

    const context = createNodeContextResolver(container.get(NODE_MANIFEST_REGISTRY)).resolve('api.fufuwang.com.cn');
    expect(context.node_id).toBe('node:hbbtzn:l1');
    expect(context.manifest_digest).toBe(manifest.manifest_digest);
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
