import { describe, expect, it } from 'vitest';
import type { ObjectStore } from '../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { catalogJobsEnvironment, createCatalogJobs } from './CatalogJobsRuntime';

describe('catalog jobs runtime', () => {
  it('builds the catalog import and publication workers', () => {
    const pool = {} as DatabasePool;
    const objects = {} as ObjectStore;
    expect(createCatalogJobs(pool, objects, 'catalog-test', 'mall:hongtai').map(({ id }) => id)).toEqual([
      'catalogimport', 'catalogpublication',
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
});
