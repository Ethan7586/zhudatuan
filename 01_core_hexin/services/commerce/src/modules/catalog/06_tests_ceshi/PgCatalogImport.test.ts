import { readFile } from 'node:fs/promises';
import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { ImportTarget } from '../../../foundation/application/BatchImport';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { parseCatalogPackage } from '../03_application_yingyong/CatalogPackage';
import { PgCatalogImport } from '../04_adapters_shixian/persistence/PgCatalogImport';

describe('catalog import persistence phases', () => {
  it('stages, validates and previews without writing any product facts before confirmation', async () => {
    const document = parseCatalogPackage(await readFile(new URL('./fixtures/catalog-package-v1.mock.json', import.meta.url)));
    const calls: QueryCall[] = [];
    const imports = new PgCatalogImport(pool(calls, (text) => text.includes('from catalog.category')
      ? [{ id: 'category:personal' }] : []));

    await imports.stage(target('uploaded'), document);

    expect(calls.some(({ text }) => /insert into (catalog\.product|catalog\.sku|catalog\.listing|pricing\.|inventory\.)/.test(text))).toBe(false);
    const ready = calls.find(({ text }) => text.includes("set state='ready'"));
    expect(ready?.values[1]).toBe(1);
    expect(JSON.parse(String(ready?.values[2]))).toMatchObject({ validCount: 1, errorCount: 0, rows: 1 });
  });

  it('writes all four fact families only after the import is running', async () => {
    const document = parseCatalogPackage(await readFile(new URL('./fixtures/catalog-package-v1.mock.json', import.meta.url)));
    const payload = { ...document.rows[0]!, packageSha: 'a'.repeat(64) };
    const calls: QueryCall[] = [];
    const imports = new PgCatalogImport(pool(calls, (text) => {
      if (text.includes('select cursor_value,total_count')) return [{ cursor_value: 0, total_count: 1 }];
      if (text.includes('from catalog.importrow stagedrow')) return [{ row_number: 2, payload, invalid: false }];
      if (text.includes('from catalog.category')) return [{ id: 'category:personal' }];
      if (text.includes('insert into inventory.stockitem')) return [{ id: 'stock:1' }];
      return [];
    }));

    expect(await imports.process(target('running'), new AbortController().signal)).toBe(true);
    expect(calls.some(({ text }) => text.includes('insert into catalog.product'))).toBe(true);
    expect(calls.some(({ text }) => text.includes('insert into catalog.listing'))).toBe(true);
    expect(calls.some(({ text }) => text.includes('insert into pricing.pricebook'))).toBe(true);
    expect(calls.some(({ text }) => text.includes('insert into inventory.stockitem'))).toBe(true);
    expect(calls.find(({ text }) => text.includes('success_count=success_count'))?.text)
      .toContain("jsonb_build_object('processed',$3::integer");
  });

  it('keeps an invalid row as an actionable error and never writes facts for it', async () => {
    const document = parseCatalogPackage(await readFile(new URL('./fixtures/catalog-package-v1.mock.json', import.meta.url)));
    const invalidDocument = { ...document, rows: [{ ...document.rows[0]!, title: '' }] };
    const stageCalls: QueryCall[] = [];
    const imports = new PgCatalogImport(pool(stageCalls, () => []));
    await imports.stage(target('uploaded'), invalidDocument);
    const error = stageCalls.find(({ text }) => text.includes('insert into catalog.importerror'));
    expect(error?.values.slice(2)).toEqual([2, 'CATALOG_TITLE_REQUIRED', 'product.title', 'product.title 必填且长度不能超过 300']);
    const summary = stageCalls.find(({ text }) => text.includes("set state='ready'"));
    expect(JSON.parse(String(summary?.values[2]))).toMatchObject({ validCount: 0, errorCount: 1 });

    const processCalls: QueryCall[] = [];
    const confirmed = new PgCatalogImport(pool(processCalls, (text) => text.includes('select cursor_value,total_count')
      ? [{ cursor_value: 0, total_count: 1 }]
      : text.includes('from catalog.importrow stagedrow')
        ? [{ row_number: 2, payload: invalidDocument.rows[0], invalid: true }] : []));
    await confirmed.process(target('running'), new AbortController().signal);
    expect(processCalls.some(({ text }) => /insert into (catalog\.product|pricing\.|inventory\.)/.test(text))).toBe(false);
    expect(processCalls.find(({ text }) => text.includes('success_count=success_count'))?.values.slice(3, 5)).toEqual([0, 1]);
  });
});

interface QueryCall { readonly text: string; readonly values: readonly unknown[] }

function target(state: ImportTarget['state']): ImportTarget {
  return { id: 'catalogimport:1', scope: 'mall:hongtai', reference: 'object:1', sha256: 'a'.repeat(64), state };
}

function pool(calls: QueryCall[], rowsFor: (text: string) => readonly Record<string, unknown>[]): DatabasePool {
  const query = async <Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) => {
    calls.push({ text, values });
    const rows = [...rowsFor(text)];
    return { rows, rowCount: rows.length } as unknown as QueryResult<Row>;
  };
  const client = {
    query,
    release() {},
  } as unknown as PoolClient;
  return {
    async connect() { return client; },
    query,
    workload() { return this; },
    async end() {},
  };
}
