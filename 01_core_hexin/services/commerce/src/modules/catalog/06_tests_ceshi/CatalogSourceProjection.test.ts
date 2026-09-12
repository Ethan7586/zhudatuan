import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { CatalogSourceProjection } from '../03_application_yingyong/CatalogSourceProjection';

describe('CatalogSourceProjection', () => {
  it('projects a cake source SKU into review-ready canonical catalog facts', async () => {
    const calls: { text: string; values?: readonly unknown[] }[] = [];
    const database = {
      query: async (text: string, values?: readonly unknown[]) => {
        calls.push(values === undefined ? { text } : { text, values });
        if (text.includes("from catalog.category where code='food'")) return result([{ id: 'category:food' }]);
        if (text.includes('returning id')) return result([{ id: 'stock:one' }]);
        return result([]);
      },
    } as unknown as OperationDatabase;

    const projected = await new CatalogSourceProjection().project(database, {
      provider: 'cake',
      scope: 'mall:one',
      region: 'cn-east-1',
      external: 'spec-7',
      version: 'source-v1',
      payload: {
        schema: 'cakeuncle.physical-sku.v1',
        productId: 'product-3',
        specId: 'spec-7',
        productName: '鲜奶生日蛋糕',
        specName: '八英寸',
        description: '新鲜现做，指定时间送达',
        brandName: '蛋糕先生',
        imagePaths: ['https://image-oss.dangaoss.cn/cake.png'],
        cityIds: ['1'],
        labels: ['当日达'],
        tastes: ['鲜奶'],
        supportsGreeting: true,
        charges: [],
        amountMinor: 19900,
        compareMinor: 22900,
        onhand: 25,
        unlimited: false,
      },
    });

    expect(projected).toMatchObject({
      product: expect.stringMatching(/^product:source:/),
      sku: expect.stringMatching(/^sku:source:/),
      listing: expect.stringMatching(/^listing:source:/),
    });
    const product = calls.find(({ text }) => text.includes('insert into catalog.product'));
    expect(product?.values?.[2]).toBe('鲜奶生日蛋糕');
    expect(JSON.parse(String(product?.values?.[3]))).toMatchObject({
      coverUrl: 'https://image-oss.dangaoss.cn/cake.png',
      description: '新鲜现做，指定时间送达',
      subtitle: '蛋糕先生 · 八英寸',
    });
    expect(calls.some(({ text }) => text.includes("status='mapped'"))).toBe(true);
    expect(calls.some(({ text }) => text.includes('insert into pricing.price'))).toBe(true);
    expect(calls.some(({ text }) => text.includes('insert into inventory.stockitem'))).toBe(true);
    const mediaJob = calls.find(({ text }) => text.includes("'catalogmediareplication'"));
    expect(mediaJob?.values?.[0]).toMatch(/^job:catalogmedia:/);
    expect(mediaJob?.values?.[1]).toBe('mall:one');
    expect(mediaJob?.values?.[2]).toBe(projected?.product);
    expect(JSON.parse(String(mediaJob?.values?.[3]))).toEqual(['https://image-oss.dangaoss.cn/cake.png']);
  });

  it('leaves unrelated providers on the existing source-only path', async () => {
    const database = { query: async () => { throw new Error('not called'); } } as unknown as OperationDatabase;
    await expect(new CatalogSourceProjection().project(database, {
      provider: 'private', scope: 'mall:one', region: 'cn-east-1', external: 'one', version: 'v1', payload: {},
    })).resolves.toBeNull();
  });

  it('rejects cake products without a usable image', async () => {
    const database = { query: async () => result([{ id: 'category:food' }]) } as unknown as OperationDatabase;
    await expect(new CatalogSourceProjection().project(database, {
      provider: 'cake', scope: 'mall:one', region: 'cn-east-1', external: 'one', version: 'v1',
      payload: {
        schema: 'cakeuncle.physical-sku.v1', productId: 'p', specId: 's', productName: '蛋糕', specName: '默认',
        description: '新鲜现做', imagePaths: [], cityIds: [], labels: [], tastes: [], supportsGreeting: false,
        charges: [], amountMinor: 1, onhand: 1, unlimited: false,
      },
    })).rejects.toThrow('CAKE_CATALOG_MEDIA_REQUIRED');
  });
});

function result(rows: readonly Record<string, unknown>[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
