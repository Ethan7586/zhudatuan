import { describe, expect, it } from 'vitest';
import type { ObjectStore } from '../foundation/infrastructure/ObjectStore';
import type { JobProcessor } from '../foundation/application/JobRunner';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { catalogJobsEnvironment, createCatalogJobs } from './CatalogJobsRuntime';

describe('catalog jobs runtime', () => {
  it('builds the catalog import and publication workers', () => {
    const pool = {} as DatabasePool;
    const objects = {} as ObjectStore;
    expect(createCatalogJobs(pool, objects, 'catalog-test', 'mall:hongtai').map(({ id }) => id)).toEqual([
      'catalogimport', 'catalogpublication', 'export',
    ]);
  });

  it('adds the media replication worker only when a processor is configured', () => {
    const pool = {} as DatabasePool;
    const objects = {} as ObjectStore;
    const processor = { process: async () => undefined } satisfies JobProcessor;
    expect(createCatalogJobs(pool, objects, 'catalog-test', 'mall:hongtai', processor).map(({ id }) => id)).toEqual([
      'catalogimport', 'catalogpublication', 'export', 'catalogmediareplication',
    ]);
  });

  it('accepts only the inputs needed by the catalog worker', () => {
    expect(catalogJobsEnvironment({
      APP_ENV: 'test',
      DATABASE_JOB_CONNECTION_REF: 'catalog/database/jobs',
      DATABASE_JOB_ROLE: 'catalogjob',
      JOB_WORKER_ID: 'catalog-test',
      OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8545',
      OBJECT_STORE_BEARER_TOKEN: 'o'.repeat(43),
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
      SECRET_STORE_BEARER_TOKEN: 'a'.repeat(43),
      NODE_MANIFEST_PATH: '/tmp/node-manifest.json',
      NODE_MANIFEST_ID: 'manifest:test',
      NODE_MANIFEST_DIGEST: `sha256:${'a'.repeat(64)}`,
      NODE_RUNTIME_INSTANCE_ID: 'runtime:test',
      NODE_RUNTIME_CONFIG_REF: 'runtime/config:test',
      NODE_RESOURCE_BINDING_VERSION: '1',
      NODE_RELEASE_POINTER_REF: '/opt/test/current',
    })).toEqual({
      APP_ENV: 'test',
      DATABASE_JOB_CONNECTION_REF: 'catalog/database/jobs',
      DATABASE_JOB_ROLE: 'catalogjob',
      JOB_WORKER_ID: 'catalog-test',
      OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8545',
      OBJECT_STORE_BEARER_TOKEN: 'o'.repeat(43),
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
      SECRET_STORE_BEARER_TOKEN: 'a'.repeat(43),
      NODE_MANIFEST_PATH: '/tmp/node-manifest.json',
      NODE_MANIFEST_ID: 'manifest:test',
      NODE_MANIFEST_DIGEST: `sha256:${'a'.repeat(64)}`,
      NODE_RUNTIME_INSTANCE_ID: 'runtime:test',
      NODE_RUNTIME_CONFIG_REF: 'runtime/config:test',
      NODE_RESOURCE_BINDING_VERSION: '1',
      NODE_RELEASE_POINTER_REF: '/opt/test/current',
    });
  });

  it('keeps explicit media runtime configuration', () => {
    const environment = catalogJobsEnvironment({
      APP_ENV: 'test', DATABASE_JOB_CONNECTION_REF: 'db', DATABASE_JOB_ROLE: 'shopjob', JOB_WORKER_ID: 'worker',
      OBJECT_STORE_ENDPOINT: 'https://objects', OBJECT_STORE_BEARER_TOKEN: 'objects-token',
      SECRET_STORE_ENDPOINT: 'https://secrets', SECRET_STORE_BEARER_TOKEN: 'secrets-token',
      NODE_MANIFEST_PATH: '/tmp/node.json', NODE_MANIFEST_ID: 'manifest:test',
      NODE_MANIFEST_DIGEST: `sha256:${'a'.repeat(64)}`, NODE_RUNTIME_INSTANCE_ID: 'runtime:test',
      NODE_RUNTIME_CONFIG_REF: 'runtime:test', NODE_RESOURCE_BINDING_VERSION: '1', NODE_RELEASE_POINTER_REF: '/tmp/current',
      CATALOG_MEDIA_REPLICATION_ENABLED: 'true', CATALOG_MEDIA_PRIMARY_TARGET_ID: 'zhudatuan',
      CATALOG_MEDIA_ZHUDATUAN_BUCKET: 'catalog-media',
    });
    expect(environment).toMatchObject({
      CATALOG_MEDIA_REPLICATION_ENABLED: 'true',
      CATALOG_MEDIA_PRIMARY_TARGET_ID: 'zhudatuan',
      CATALOG_MEDIA_ZHUDATUAN_BUCKET: 'catalog-media',
    });
  });
});
