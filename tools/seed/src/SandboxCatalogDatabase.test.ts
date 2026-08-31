import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const sql = await readFile(new URL('./SandboxCatalogDatabase.sql', import.meta.url), 'utf8');
const runner = await readFile(new URL('./BootstrapSandboxCatalog.ts', import.meta.url), 'utf8');

test('sandbox catalog is an explicit native mall application and complete offer fixture', () => {
  assert.match(sql, /'application:zhudatuan:sandbox:v1','mall-zhudatuan'/);
  assert.match(sql, /'active','version:zhudatuan:sandbox:v1'/);
  assert.match(sql, /'product:zhudatuan:sandbox:welcome'/);
  assert.match(sql, /'sku:zhudatuan:sandbox:welcome'/);
  assert.match(sql, /'pool:zhudatuan:sandbox','mall-zhudatuan','private'/);
  assert.match(sql, /'listing:zhudatuan:sandbox:welcome'.*'published'/s);
  assert.match(sql, /'pricebook:zhudatuan:sandbox'.*'CNY'/s);
  assert.match(sql, /'price:zhudatuan:sandbox:welcome'.*,100,100,/s);
  assert.match(sql, /'stock:zhudatuan:sandbox:welcome'.*'sandbox:main',100,0,1,'active'/s);
  assert.match(sql, /'sandbox\.zhudatuan\.invalid'/);
  assert.match(sql, /'release:zhudatuan:sandbox:v1'.*'active'/s);
  assert.match(sql, /'publication:zhudatuan:sandbox:v1'.*'active'/s);
  assert.match(sql, /'audit:zhudatuan:sandbox-publication:v1'/);
});

test('seed SQL is insert-only and cannot mutate restricted business domains', () => {
  const tables = [...sql.matchAll(/insert into\s+([a-z]+\.[a-z]+)/gi)].map((match) => match[1]!.toLowerCase());
  const allowed = new Set([
    'audit.record',
    'catalog.category',
    'catalog.listing',
    'catalog.pool',
    'catalog.poolbinding',
    'catalog.poolitem',
    'catalog.product',
    'catalog.sku',
    'experience.application',
    'experience.binding',
    'experience.publication',
    'experience.release',
    'experience.version',
    'inventory.stockitem',
    'pricing.price',
    'pricing.pricebook',
  ]);
  assert.ok(tables.length > 0);
  assert.deepEqual([...new Set(tables)].sort(), [...allowed].sort());
  assert.doesNotMatch(sql, /\bupdate\s+[a-z]+\.[a-z]+|\bdelete\s+from\s+[a-z]+\.[a-z]+/i);
  assert.ok(tables.every((table) => !/^(finance|payment|ordering|benefit|channel|extension)\./.test(table)));
  assert.match(sql, /'productionData',false/);
  assert.match(sql, /'financeMutation',false/);
  assert.match(sql, /'paymentMutation',false/);
  assert.match(sql, /'orderMutation',false/);
});

test('runner serializes the seed with the canonical mall audit chain', () => {
  assert.match(runner, /begin isolation level serializable/);
  assert.match(runner, /pg_advisory_xact_lock\(hashtext\('zhudatuan:sandbox-catalog:v1'\)\)/);
  assert.match(runner, /pg_advisory_xact_lock\(hashtextextended\('audit:mall-zhudatuan',0\)\)/);
  assert.ok(runner.indexOf("hashtextextended('audit:mall-zhudatuan',0)") < runner.indexOf('database.query(source)'));
  assert.match(runner, /assertDatabaseBoundary/);
  assert.match(runner, /database_role !== 'zhudatuansandboxbootstrap'/);
  assert.match(runner, /deployment\.sandbox_catalog_bootstrap_boundary\(\$2\)/);
  assert.match(runner, /version=\$1 and checksum=\$3/);
  assert.match(runner, /row\.schema_checksum !== SANDBOX_CATALOG_SCHEMA_CHECKSUM/);
  assert.doesNotMatch(runner, /deployment\.registration_bootstrap_boundary/);
});
