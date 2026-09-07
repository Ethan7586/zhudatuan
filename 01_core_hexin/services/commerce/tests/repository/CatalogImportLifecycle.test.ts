import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import type { ClaimedJob } from '../../src/foundation/application/JobRunner';
import type { OperationDatabase } from '../../src/foundation/application/ModuleOperations';
import type { ObjectStore } from '../../src/foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../src/foundation/persistence/Pool';
import type { AccessContext } from '../../src/foundation/security/AccessContext';
import { confirmCatalogImport, createOrReuseCatalogImport } from '../../src/modules/catalog/03_application_yingyong/CatalogImportOperations';
import { CatalogImportProcessor } from '../../src/modules/catalog/05_interface_jieru/job/CatalogImportJob';

const connection = process.env.SHOP_TEST_DATABASE_URL;
const endpointAvailable = connection !== undefined || process.env.PGHOST !== undefined;

describe.runIf(endpointAvailable)('catalog import PostgreSQL lifecycle', () => {
  it('uploads a new package, validates it and confirms processing on PostgreSQL', async () => {
    const pool = new Pool({
      ...(connection === undefined ? {} : { connectionString: connection }),
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
      max: 4,
    });
    const suffix = randomUUID();
    const scope = `mall:catalog-import-test:${suffix}`;
    const bytes = await packageBytes(suffix);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const reference = `object:catalog-import-test:${suffix}`;
    let importId = '';

    try {
      const upload = await transaction(pool, (client) =>
        createOrReuseCatalogImport(client as unknown as OperationDatabase, {
          kind: 'upload',
          access: access(scope),
          reference,
          sha256,
        })
      );
      const uploadBody = upload.body as Readonly<{ id: string; state: string; duplicate: boolean }>;
      importId = uploadBody.id;
      expect(upload).toMatchObject({ status: 202 });
      expect(uploadBody).toMatchObject({ state: 'uploaded', duplicate: false });

      const processor = new CatalogImportProcessor(pool as unknown as DatabasePool, objectStore(reference, sha256, bytes));
      await processor.process(job(importId, scope), new AbortController().signal);
      const validated = await pool.query<{ state: string; total_count: number; error_count: number }>(
        `
        select state,total_count,coalesce((validation_summary->>'errorCount')::integer,-1) error_count
        from catalog.importjob where id=$1`,
        [importId]
      );
      expect(validated.rows[0]).toEqual({ state: 'ready', total_count: 1, error_count: 0 });

      const confirmation = await transaction(pool, (client) =>
        confirmCatalogImport(client as unknown as OperationDatabase, {
          kind: 'confirm',
          access: access(scope),
          importId,
        })
      );
      expect(confirmation).toMatchObject({ status: 202, body: { state: 'running', confirmed: true, duplicate: false } });

      const scheduled = await pool.query<{ id: string; import_id: string }>(
        `
        select id,payload->>'import' import_id from runtime.job
        where payload->>'import'=$1 order by id`,
        [importId]
      );
      expect(scheduled.rows).toEqual([
        { id: `job:${importId}:0`, import_id: importId },
        { id: `job:${importId}:confirm`, import_id: importId },
      ]);
    } finally {
      await cleanup(pool, sha256);
      await pool.end();
    }
  });
});

async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await operation(client);
    await client.query('commit');
    return result;
  } catch (cause) {
    await client.query('rollback');
    throw cause;
  } finally {
    client.release();
  }
}

async function cleanup(pool: Pool, sha256: string): Promise<void> {
  await pool.query(
    `delete from runtime.job where payload->>'import' in
    (select id from catalog.importjob where sha256=$1)`,
    [sha256]
  );
  await pool.query(
    `delete from catalog.importerror where job_id in
    (select id from catalog.importjob where sha256=$1)`,
    [sha256]
  );
  await pool.query(
    `delete from catalog.importrow where job_id in
    (select id from catalog.importjob where sha256=$1)`,
    [sha256]
  );
  await pool.query('delete from catalog.importjob where sha256=$1', [sha256]);
}

function job(importId: string, scope: string): ClaimedJob {
  return { id: `job:${importId}:0`, kind: 'catalogimport', scope_id: scope, payload: { import: importId }, attempts: 1 };
}

function access(scope: string): AccessContext {
  return { scope: { kind: 'mall', id: scope }, actor: { target: 'console' } } as unknown as AccessContext;
}

function objectStore(reference: string, sha256: string, bytes: Uint8Array): ObjectStore {
  return {
    create: async () => {
      throw new Error('UNEXPECTED_OBJECT_WRITE');
    },
    find: async () => null,
    read: async (candidate, maximum) => {
      if (candidate !== reference || bytes.byteLength > maximum) throw new Error('UNEXPECTED_OBJECT_READ');
      return bytes;
    },
    inspect: async (candidate) => {
      if (candidate !== reference) throw new Error('UNEXPECTED_OBJECT_INSPECTION');
      return { reference, sha256, size: bytes.byteLength, scan: 'clean', contentType: 'application/json' };
    },
    authorize: async () => {
      throw new Error('UNEXPECTED_OBJECT_AUTHORIZATION');
    },
  };
}

async function packageBytes(suffix: string): Promise<Uint8Array> {
  const fixture = JSON.parse(await readFile(new URL('../../src/modules/catalog/06_tests_ceshi/fixtures/catalog-package-v1.mock.json', import.meta.url), 'utf8')) as {
    packageId: string;
    items: Array<{ source: { productRef: string; skuRef: string }; sku: { code: string } }>;
  };
  fixture.packageId = `catalog-import-test-${suffix}`;
  fixture.items[0]!.source.productRef = `PRODUCT-${suffix}`;
  fixture.items[0]!.source.skuRef = `SKU-${suffix}`;
  fixture.items[0]!.sku.code = `CATALOG-IMPORT-${suffix}`;
  return new TextEncoder().encode(JSON.stringify(fixture));
}
