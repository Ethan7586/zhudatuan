import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('商品目录反向查询索引迁移', () => {
  let database: PGlite;

  beforeAll(async () => {
    database = new PGlite();
    await database.exec(`
      create schema catalog;
      create table catalog.product(id text primary key);
      create table catalog.sku(id text primary key,product_id text not null references catalog.product(id));
      create table catalog.listing(id text primary key,scope_id text not null,sku_id text not null references catalog.sku(id));
      create table catalog.sourcelisting(id text primary key,scope_id text not null,sku_id text references catalog.sku(id));
    `);
    const migration = await readFile(resolve(process.cwd(),
      '../../../02_platform_pingtai/database/supabase/migrations/20260912130000_index_catalog_reverse_lookups.sql'), 'utf8');
    await database.exec(migration);
  });

  afterAll(async () => database.close());

  it('indexes every reverse lookup used by catalog row access policies', async () => {
    const result = await database.query<{ indexname: string }>(`select indexname from pg_indexes
      where schemaname='catalog' and indexname like 'catalog_%_lookup' order by indexname`);

    expect(result.rows.map(({ indexname }) => indexname)).toEqual([
      'catalog_listing_sku_scope_lookup',
      'catalog_sku_product_lookup',
      'catalog_source_listing_sku_scope_lookup',
    ]);
  });
});
