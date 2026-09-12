import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { CatalogMediaReplication } from '../03_application_yingyong/CatalogMediaReplication';
import {
  CatalogProductMediaRegistration,
  type CatalogProductMediaRegistrationInput,
} from '../03_application_yingyong/CatalogProductMediaRegistration';
import { importProduct } from '../03_application_yingyong/CatalogProductImport';
import { parseCatalogPackage } from '../03_application_yingyong/CatalogPackage';
import type {
  CatalogMediaObjectStorage,
  CatalogMediaObjectUpload,
  CatalogMediaStoredObject,
  CatalogMediaTarget,
} from '../03_application_yingyong/port/CatalogMediaObjectStorage';
import { PgCatalogMediaPersistence } from '../04_adapters_shixian/persistence/PgCatalogMediaPersistence';

const migration = fileURLToPath(new URL('../../../../../../../02_platform_pingtai/database/supabase/migrations/20260912210000_catalog_media_replication_persistence.sql', import.meta.url));
const mediaBytes = new TextEncoder().encode('mock-cake-cover-image');
const databases: PGlite[] = [];

describe('CatalogProductMediaRegistration persistence', () => {
  afterEach(async () => {
    await Promise.all(databases.splice(0).map((database) => database.close()));
  });

  it('persists one complete media object, two replicas and one ready product binding', async () => {
    const database = await testDatabase();
    const { service } = registration(targets());

    const result = await service.register(operationDatabase(database), mediaInput());

    expect(result).toMatchObject({ overallStatus: 'complete', bindingStatus: 'ready' });
    await expect(counts(database)).resolves.toEqual({ mediaObjects: 1, replicas: 2, bindings: 1 });
    const binding = await database.query('select product_id,media_id,purpose,position,state from catalog.productmedia');
    expect(binding.rows).toEqual([{
      product_id: 'product:fixture', media_id: result.mediaId, purpose: 'cover', position: 0, state: 'ready',
    }]);
  });

  it('persists an incomplete required attempt and both replica states without a ready binding', async () => {
    const database = await testDatabase();
    const setup = registration(targets());
    setup.stores.get('fufu')!.uploadError = new Error('FUFU_UPLOAD_FAILED');

    const result = await setup.service.register(operationDatabase(database), mediaInput());

    expect(result).toMatchObject({ overallStatus: 'incomplete', bindingStatus: 'not_ready' });
    await expect(counts(database)).resolves.toEqual({ mediaObjects: 1, replicas: 2, bindings: 0 });
    const replicas = await database.query('select target_id,upload_status,verification_status,error from catalog.mediareplica order by target_id');
    expect(replicas.rows).toEqual([
      { target_id: 'fufu', upload_status: 'failed', verification_status: 'failed', error: 'FUFU_UPLOAD_FAILED' },
      { target_id: 'zhudatuan', upload_status: 'uploaded', verification_status: 'verified', error: null },
    ]);
  });

  it('keeps optional failure details while the required result binds as ready', async () => {
    const configured = [...targets(), target('optional', false)];
    const database = await testDatabase();
    const setup = registration(configured);
    setup.stores.get('optional')!.uploadError = new Error('OPTIONAL_UPLOAD_FAILED');

    const result = await setup.service.register(operationDatabase(database), mediaInput());

    expect(result).toMatchObject({ overallStatus: 'complete', bindingStatus: 'ready' });
    await expect(counts(database)).resolves.toEqual({ mediaObjects: 1, replicas: 3, bindings: 1 });
    const optional = await database.query("select required,upload_status,error from catalog.mediareplica where target_id='optional'");
    expect(optional.rows[0]).toEqual({ required: false, upload_status: 'failed', error: 'OPTIONAL_UPLOAD_FAILED' });
  });

  it('upserts identical retries without increasing object, replica or binding counts', async () => {
    const database = await testDatabase();
    const { service } = registration(targets());

    const first = await service.register(operationDatabase(database), mediaInput());
    const retry = await service.register(operationDatabase(database), mediaInput());

    expect(retry.objectKey).toBe(first.objectKey);
    await expect(counts(database)).resolves.toEqual({ mediaObjects: 1, replicas: 2, bindings: 1 });
  });

  it('updates a failed required replica to verified and creates the ready binding on retry', async () => {
    const database = await testDatabase();
    const setup = registration(targets());
    setup.stores.get('fufu')!.uploadError = new Error('FUFU_UPLOAD_FAILED');

    const failed = await setup.service.register(operationDatabase(database), mediaInput());
    setup.stores.get('fufu')!.uploadError = null;
    const recovered = await setup.service.register(operationDatabase(database), mediaInput());

    expect(failed.overallStatus).toBe('incomplete');
    expect(recovered).toMatchObject({ mediaId: failed.mediaId, objectKey: failed.objectKey, overallStatus: 'complete', bindingStatus: 'ready' });
    await expect(counts(database)).resolves.toEqual({ mediaObjects: 1, replicas: 2, bindings: 1 });
    const persisted = await database.query('select overall_status from catalog.mediaobject');
    const replicas = await database.query('select upload_status,verification_status,error from catalog.mediareplica order by target_id');
    expect(persisted.rows[0]).toEqual({ overall_status: 'complete' });
    expect(replicas.rows).toEqual([
      { upload_status: 'uploaded', verification_status: 'verified', error: null },
      { upload_status: 'uploaded', verification_status: 'verified', error: null },
    ]);
  });

  it('removes an existing ready binding when a required replica later becomes incomplete', async () => {
    const database = await testDatabase();
    const setup = registration(targets());
    const complete = await setup.service.register(operationDatabase(database), mediaInput());
    expect(complete.bindingStatus).toBe('ready');

    setup.stores.get('fufu')!.uploadError = new Error('FUFU_RETRY_FAILED');
    const incomplete = await setup.service.register(operationDatabase(database), mediaInput());

    expect(incomplete).toMatchObject({ overallStatus: 'incomplete', bindingStatus: 'not_ready' });
    await expect(counts(database)).resolves.toEqual({ mediaObjects: 1, replicas: 2, bindings: 0 });
  });

  it('persists three targets without schema or application changes', async () => {
    const configured = [...targets(), target('third', true)];
    const database = await testDatabase();
    const { service } = registration(configured);

    await service.register(operationDatabase(database), mediaInput());

    await expect(counts(database)).resolves.toEqual({ mediaObjects: 1, replicas: 3, bindings: 1 });
    const replicas = await database.query<{ target_id: string }>('select target_id from catalog.mediareplica order by target_id');
    expect(replicas.rows.map(({ target_id }) => target_id)).toEqual(['fufu', 'third', 'zhudatuan']);
  });

  it('stores cover, gallery and detail positions as stable ready slots', async () => {
    const database = await testDatabase();
    const { service } = registration(targets());

    await service.register(operationDatabase(database), mediaInput({ purpose: 'cover', position: 0 }));
    await service.register(operationDatabase(database), mediaInput({ purpose: 'gallery', position: 2 }));
    await service.register(operationDatabase(database), mediaInput({ purpose: 'detail', position: 7 }));

    const bindings = await database.query('select purpose,position,state from catalog.productmedia order by position');
    expect(bindings.rows).toEqual([
      { purpose: 'cover', position: 0, state: 'ready' },
      { purpose: 'gallery', position: 2, state: 'ready' },
      { purpose: 'detail', position: 7, state: 'ready' },
    ]);
  });

  it('persists the coordinator object identity and excludes secrets and supplier source URLs', async () => {
    const database = await testDatabase();
    const { service } = registration(targets());
    const runtimeInput = { ...mediaInput(), supplierSourceUrl: 'https://supplier.example/original.jpg', accessKeySecret: 'not-persisted' };

    const result = await service.register(operationDatabase(database), runtimeInput);
    const media = await database.query('select media_id,object_key,sha256,content_type,byte_size,overall_status from catalog.mediaobject');
    const databaseText = JSON.stringify([
      ...media.rows,
      ...(await database.query('select * from catalog.mediareplica')).rows,
      ...(await database.query('select * from catalog.productmedia')).rows,
    ]);

    expect(media.rows[0]).toEqual({
      media_id: result.mediaId,
      object_key: result.objectKey,
      sha256: result.sha256,
      content_type: result.contentType,
      byte_size: result.byteSize,
      overall_status: result.overallStatus,
    });
    expect(JSON.stringify(result)).not.toContain('supplier.example');
    expect(JSON.stringify(result)).not.toContain('not-persisted');
    expect(databaseText).not.toContain('supplier.example');
    expect(databaseText).not.toContain('not-persisted');
  });

  it('imports one explicitly mocked cake product and binds its replicated media without duplicating product facts', async () => {
    const database = await testDatabase(false);
    const document = parseCatalogPackage(await readFile(new URL('./fixtures/catalog-cake-media.mock.json', import.meta.url)));
    const facts = await importProduct(operationDatabase(database), 'mall:mock-cake', 'catalogimport:mock-cake', 2, {
      ...document.rows[0]!, packageSha: 'c'.repeat(64),
    });
    const { service } = registration(targets());

    const media = await service.register(operationDatabase(database), mediaInput({ productId: facts.product }));

    expect(document.summary).toMatchObject({ packageId: 'mock-cake-media-20260910', rows: 1 });
    expect(media).toMatchObject({ productId: facts.product, overallStatus: 'complete', bindingStatus: 'ready' });
    const factsCount = await database.query<{ products: number; skus: number; listings: number }>(`select
      (select count(*)::integer from catalog.product where id=$1) products,
      (select count(*)::integer from catalog.sku where product_id=$1) skus,
      (select count(*)::integer from catalog.listing where sku_id=$2) listings`, [facts.product, facts.sku]);
    expect(factsCount.rows[0]).toEqual({ products: 1, skus: 1, listings: 1 });
    await expect(counts(database)).resolves.toEqual({ mediaObjects: 1, replicas: 2, bindings: 1 });
  });

  it('applies the managed migration and records its schema ledger entry', async () => {
    const database = await testDatabase();
    const ledger = await database.query("select version,checksum from runtime.schemaversion where version='20260912210000'");

    expect(ledger.rows).toEqual([{
      version: '20260912210000', checksum: 'f1cf6a31ded78182cd64d96f45d81d75ef658b191a4c56bd8402cca18f0de485',
    }]);
  });
});

async function testDatabase(seedProduct = true): Promise<PGlite> {
  const database = new PGlite();
  databases.push(database);
  await database.exec(`
    create schema runtime;
    create schema catalog;
    create schema pricing;
    create schema inventory;
    create table runtime.schemaversion(version text primary key,checksum char(64) not null,applied_at timestamptz not null default clock_timestamp());
    insert into runtime.schemaversion(version,checksum) values('20260912200000','c68b7a5a79051d781f53f9e4db32c9c52d3c3b899e776b861a96280d6355cf70');
    create table catalog.category(id text primary key,code text not null unique,status text not null);
    insert into catalog.category(id,code,status) values('category:cake','cake','active');
    create table catalog.product(id text primary key,owner_partner_id text,brand_id text,category_id text not null references catalog.category(id),title text not null,product_type text not null,attributes jsonb not null,status text not null,version bigint not null,created_at timestamptz not null,updated_at timestamptz not null);
    create table catalog.sku(id text primary key,product_id text not null references catalog.product(id),code text not null unique,specifications jsonb not null,status text not null,version bigint not null);
    create table catalog.listing(id text primary key,scope_id text not null,pool_id text,sku_id text not null references catalog.sku(id),title text not null,status text not null,effective_at timestamptz,expires_at timestamptz,version bigint not null,created_at timestamptz not null,updated_at timestamptz not null,unique(scope_id,sku_id));
    create table pricing.pricebook(id text primary key,scope_id text not null,currency char(3) not null,name text not null,status text not null,version bigint not null,unique(scope_id,name));
    create table pricing.price(id text primary key,book_id text not null references pricing.pricebook(id),sku_id text not null,amount_minor bigint not null,compare_minor bigint,effective_at timestamptz not null,expires_at timestamptz,unique(book_id,sku_id,effective_at));
    create table inventory.stockitem(id text primary key,scope_id text not null,sku_id text not null,location_id text not null,onhand bigint not null,safety bigint not null,version bigint not null,status text not null,updated_at timestamptz not null,unique(scope_id,sku_id,location_id));
    create table inventory.snapshot(stockitem_id text not null references inventory.stockitem(id),observed_at timestamptz not null,source text not null,onhand bigint not null,source_version text not null);
  `);
  if (seedProduct) {
    await database.exec(`insert into catalog.product(id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
      values('product:fixture','category:cake','测试商品','physical','{}','active',0,clock_timestamp(),clock_timestamp())`);
  }
  await database.exec(await readFile(migration, 'utf8'));
  return database;
}

function operationDatabase(database: PGlite): OperationDatabase {
  return database as unknown as OperationDatabase;
}

function registration(configured: readonly CatalogMediaTarget[]) {
  const stores = new Map(configured.map(({ id }) => [id, new MemoryMediaStorage()]));
  return {
    stores,
    service: new CatalogProductMediaRegistration(
      new CatalogMediaReplication(configured, ({ id }) => stores.get(id)!),
      new PgCatalogMediaPersistence(),
    ),
  };
}

function targets(): readonly CatalogMediaTarget[] {
  return [target('zhudatuan', true), target('fufu', true)];
}

function target(id: string, required: boolean): CatalogMediaTarget {
  return {
    id, provider: 'aliyun-oss', endpoint: `oss-${id}.example`, region: 'cn-test', bucket: `${id}-media`,
    publicBaseUrl: `https://media.${id}.example`, required, enabled: true,
  };
}

function mediaInput(overrides: Partial<CatalogProductMediaRegistrationInput> = {}): CatalogProductMediaRegistrationInput {
  return { ...baseMediaInput(), ...overrides };
}

function baseMediaInput() {
  return { productId: 'product:fixture', bytes: mediaBytes, contentType: 'image/webp', purpose: 'cover' as const, position: 0 };
}

async function counts(database: PGlite): Promise<{ mediaObjects: number; replicas: number; bindings: number }> {
  const result = await database.query<{ media_objects: number; replicas: number; bindings: number }>(`select
    (select count(*)::integer from catalog.mediaobject) media_objects,
    (select count(*)::integer from catalog.mediareplica) replicas,
    (select count(*)::integer from catalog.productmedia) bindings`);
  const row = result.rows[0]!;
  return { mediaObjects: row.media_objects, replicas: row.replicas, bindings: row.bindings };
}

class MemoryMediaStorage implements CatalogMediaObjectStorage {
  readonly objects = new Map<string, CatalogMediaObjectUpload>();
  uploadError: Error | null = null;

  async upload(input: CatalogMediaObjectUpload): Promise<void> {
    if (this.uploadError) throw this.uploadError;
    this.objects.set(input.objectKey, input);
  }

  async inspect(objectKey: string): Promise<CatalogMediaStoredObject> {
    const object = this.objects.get(objectKey);
    return object
      ? { exists: true, byteSize: object.bytes.byteLength, sha256: createHash('sha256').update(object.bytes).digest('hex') }
      : { exists: false, byteSize: 0, sha256: null };
  }
}
