import { readFile } from 'node:fs/promises';
import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { parseCatalogPackage } from '../03_application_yingyong/CatalogPackage';
import { catalogImportFailure, importProduct, validateCatalogProduct } from '../03_application_yingyong/CatalogProductImport';

describe('catalog-package/v1', () => {
  it('parses the marked mock fixture as a locally importable standard package', async () => {
    const document = parseCatalogPackage(await readFile(new URL('./fixtures/catalog-package-v1.mock.json', import.meta.url)));
    expect(document.packageId).toBe('mockpool-feasibility-20260907');
    expect(document.summary).toMatchObject({ format: 'catalog-package/v1', rows: 1 });
    expect(document.rows[0]).toMatchObject({ sku: 'MOCKPOOL-SKU-0001-01', currency: 'CNY', status: 'draft' });
    expect(JSON.parse(document.rows[0]!.packageSource!)).toMatchObject({ dataSource: 'simulated', isMock: true });
  });

  it('writes one validated row to catalog, pricing and inventory in the exact mall scope', async () => {
    const document = parseCatalogPackage(await readFile(new URL('./fixtures/catalog-package-v1.mock.json', import.meta.url)));
    const calls: QueryCall[] = [];
    const database = recordingDatabase(calls);

    const facts = await importProduct(database, 'mall:hongtai', 'catalogimport:1', 2, {
      ...document.rows[0]!, packageSha: 'a'.repeat(64),
    });

    expect(facts.product).toMatch(/^product:package:/);
    expect(calls.find(({ text }) => text.includes('insert into catalog.listing'))?.values[1]).toBe('mall:hongtai');
    expect(calls.find(({ text }) => text.includes('insert into pricing.pricebook'))?.values[1]).toBe('mall:hongtai');
    expect(calls.find(({ text }) => text.includes('insert into inventory.stockitem'))?.values[1]).toBe('mall:hongtai');
    const productAttributes = JSON.parse(String(calls.find(({ text }) => text.includes('insert into catalog.product'))?.values[4]));
    expect(productAttributes.packageSource).toMatchObject({ dataSource: 'simulated', isMock: true });
    expect(productAttributes.media).toEqual([{ kind: 'image', reference: 'fixture:mockpool/MOCKPOOL-SKU-0001-01' }]);
  });

  it('returns stable row and field errors before facts are written', async () => {
    const document = parseCatalogPackage(await readFile(new URL('./fixtures/catalog-package-v1.mock.json', import.meta.url)));
    const database = recordingDatabase([]);
    const seen = new Set<string>();
    await validateCatalogProduct(database, 'mall:hongtai', document.rows[0]!, seen);
    await expect(validateCatalogProduct(database, 'mall:hongtai', document.rows[0]!, seen)).rejects.toThrow('CATALOG_SKU_DUPLICATE');

    try {
      await validateCatalogProduct(database, 'mall:hongtai', { ...document.rows[0]!, compareMinor: '1' });
      throw new Error('EXPECTED_VALIDATION_FAILURE');
    } catch (cause) {
      expect(catalogImportFailure(cause)).toEqual({
        reason: 'CATALOG_COMPARE_PRICE_INVALID', field: 'offer.compareMinor', detail: '划线价不得低于售价',
      });
    }
  });
});

interface QueryCall { readonly text: string; readonly values: readonly unknown[] }

function recordingDatabase(calls: QueryCall[]): OperationDatabase {
  return {
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      calls.push({ text, values });
      const rows = text.includes('from catalog.category') ? [{ id: 'category:personal' }]
        : text.includes('select id from catalog.sku') ? []
          : text.includes('insert into inventory.stockitem') ? [{ id: 'stock:mall-hongtai' }] : [];
      return { rows, rowCount: rows.length } as unknown as QueryResult<Row>;
    },
  };
}
