import { describe, expect, it } from 'vitest';
import type { ObjectStore } from '../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { catalogJobsEnvironment, createCatalogJobs } from './CatalogJobsRuntime';

describe('catalog jobs runtime', () => {
  it('builds only the catalog import worker', () => {
    const pool = {} as DatabasePool;
    const objects = {} as ObjectStore;
    expect(createCatalogJobs(pool, objects, 'catalog-test').map(({ id }) => id)).toEqual(['catalogimport']);
  });

  it('accepts only the inputs needed by the catalog worker', () => {
    expect(catalogJobsEnvironment({
      DATABASE_JOB_CONNECTION_REF: 'catalog/database/jobs',
      JOB_WORKER_ID: 'catalog-test',
      OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8545',
      OBJECT_STORE_BEARER_TOKEN: 'o'.repeat(43),
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
      SECRET_STORE_BEARER_TOKEN: 'a'.repeat(43),
    })).toEqual({
      DATABASE_JOB_CONNECTION_REF: 'catalog/database/jobs',
      JOB_WORKER_ID: 'catalog-test',
      OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8545',
      OBJECT_STORE_BEARER_TOKEN: 'o'.repeat(43),
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
      SECRET_STORE_BEARER_TOKEN: 'a'.repeat(43),
    });
  });
});
