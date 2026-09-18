import { readFile } from 'node:fs/promises';
import type { OperationId } from '@shop/contract';
import { parseNodeManifest } from '@shop/config/server';
import { describe, expect, it } from 'vitest';
import { bootstrapApi, bindServerNodeManifestRegistry, runtimeNodeManifestRegistry } from '../bootstrap/ApiBootstrap';
import { ExtensionRegistry } from '../bootstrap/ExtensionRegistry';
import { NODE_DATABASE_ROLE, NODE_MANIFEST } from '../bootstrap/NodeRuntime';
import type { OperationHandler } from '../foundation/application/OperationHandler';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { OBJECT_STORE } from '../foundation/infrastructure/ObjectStore';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { DATABASE_POOL, type DatabasePool } from '../foundation/persistence/Pool';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { CATALOG_OPERATOR_OPERATION_IDS } from '../modules/catalog/03_application_yingyong/CatalogOperatorOperations';
import { CatalogOperatorModule } from '../modules/catalog/IdentityOperatorCatalogModule';
import { CATALOG_OPERATOR_RUNTIME_OPERATION_IDS } from '../modules/runtime/CatalogOperatorRuntimeOperations';
import { CatalogOperatorRuntimeModule } from '../modules/runtime/CatalogOperatorRuntimeModule';

describe('catalog operator API entrypoint', () => {
  it('owns catalog routes without identity or member routes', async () => {
    const manifestPath = new URL('../../../../../02_platform_pingtai/config/node-manifests/hbbtzn-l1.json', import.meta.url);
    const manifest = await parseNodeManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
    const pool = { workload: () => pool } as unknown as DatabasePool;
    const operationIds = [...CATALOG_OPERATOR_RUNTIME_OPERATION_IDS, ...CATALOG_OPERATOR_OPERATION_IDS];
    const bootstrapped = await bootstrapApi({
      modules: [CatalogOperatorRuntimeModule, CatalogOperatorModule],
      operationIds,
      extensions: new ExtensionRegistry({ verify: async () => false }),
      allowedOrigins: ['https://console.hbbtzn.com'],
      telemetry: commerceTelemetry(),
      runtimeNodeIds: [manifest.node_id],
      configure(container) {
        bindServerNodeManifestRegistry(container, runtimeNodeManifestRegistry(manifest));
        container.bind(OPERATION_HANDLERS, new Map<OperationId, OperationHandler>());
        container.bind(OPERATION_AUTHORIZER, { authorize: async () => { throw new Error('AUTHORIZATION_NOT_CALLED'); } });
        container.bind(DATABASE_POOL, pool);
        container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
        container.bind(OBJECT_STORE, {
          create: async () => { throw new Error('OBJECT_UPLOAD_NOT_CALLED'); },
          find: async () => null,
          read: async () => new Uint8Array(),
          inspect: async () => { throw new Error('OBJECT_INSPECT_NOT_CALLED'); },
          authorize: async () => { throw new Error('OBJECT_AUTHORIZE_NOT_CALLED'); },
        });
        container.bind(NODE_MANIFEST, manifest);
        container.bind(NODE_DATABASE_ROLE, 'hbbtzncatalogapi');
      },
    });

    expect(CatalogOperatorModule.dependencies).toEqual([]);
    expect(bootstrapped.routes.match('POST', '/api/v1/catalog/imports')?.operation).toBe('catalog.imports.create');
    expect(bootstrapped.routes.match('GET', '/api/v1/catalog/imports/test')?.operation).toBe('catalog.imports.read');
    expect(bootstrapped.routes.match('POST', '/api/v1/catalog/listings/batches')?.operation).toBe('catalog.listings.batch');
    expect(bootstrapped.routes.match('POST', '/api/v1/identity/sessions')).toBeNull();
    expect(bootstrapped.routes.match('GET', '/api/v1/members')).toBeNull();
    expect(bootstrapped.arch.inspect(manifest.node_id, bootstrapped.routes.catalog().map(({ operation }) => operation))
      .every(({ state }) => state === 'connected')).toBe(true);
    expect(bootstrapped.arch.state('node:zhudatuan:l0', CATALOG_OPERATOR_OPERATION_IDS[0]!)).toBe('unmounted');
    expect(() => bootstrapped.nodeContextResolver?.resolve('api.fufu.wang'))
      .toThrow('SFL_NODE_MANIFEST_HOST_RUNTIME_MISMATCH');
  });
});
