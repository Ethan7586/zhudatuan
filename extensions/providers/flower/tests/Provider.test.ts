<<<<<<< HEAD
import { describe, expect, it, vi } from 'vitest';

import { REQUIRED_PROVIDER_IDS, type JsonObject, type ProviderCallContext } from '@shop/contract';
import { STANDARD_PROVIDER_LIMITS } from '@shop/providercore';
import { CAKEUNCLE_PHYSICAL_ENDPOINTS } from '@shop/vendorcakeuncle';

import { FLOWER_CATEGORIES_OPERATION, flowerEndpointConfiguration, type FlowerConnection, type FlowerTransport } from '../FlowerClient';
import { FLOWER_UNLIMITED_ONHAND } from '../Mapper';
import { FlowerProvider, createFlowerPorts } from '../Provider';
import { manifest } from '../manifest';

const context: ProviderCallContext = {
  tenantId: 'tenant:test', requestId: 'request:test', traceId: 'trace:test', deadline: Date.now() + 5_000,
};

const categories: JsonObject = {
  code: 200,
  msg: 'success',
  data: [
    { id: '8', parent_id: '0', level: '1', name: '花' },
    { id: '66', parent_id: '8', level: '2', name: '甄选鲜花' },
    { id: '68', parent_id: '66', level: '3', name: '生日鲜花' },
    { id: '67', parent_id: '66', level: '3', name: '表达爱意' },
    { id: '1', parent_id: '0', level: '1', name: '蛋糕' },
  ],
};

const connection: FlowerConnection = {
  id: 'flower:sandbox',
  baseUrl: 'https://dev.dangaoss.cn',
  secret: { channelNo: 'channel-test', channelKey: 'key-test' },
  endpoints: {
    [FLOWER_CATEGORIES_OPERATION]: CAKEUNCLE_PHYSICAL_ENDPOINTS.categories,
    'flower.category.8': CAKEUNCLE_PHYSICAL_ENDPOINTS.products,
  },
  healthOperation: FLOWER_CATEGORIES_OPERATION,
  limits: STANDARD_PROVIDER_LIMITS,
};

describe('flower provider contract', () => {
  it('exposes only the documented read-only capabilities and ports', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('flower');
    const signed = manifest('signed');
    expect(signed).toMatchObject({ version: '1.1.0', contractVersion: 'flower.v2',
      capabilities: ['Catalog', 'Price', 'Inventory'], secretRefs: ['channelNo', 'channelKey'], eventSubscriptions: [] });
    const provider = FlowerProvider.create({ manifest: signed, connection });
    expect(provider.has('catalog')).toBe(true);
    expect(provider.has('price')).toBe(true);
    expect(provider.has('stock')).toBe(true);
    expect(provider.has('order')).toBe(false);
    expect(provider.has('webhook')).toBe(false);
    expect(() => manifest('')).toThrow('FLOWER_MANIFEST_SIGNATURE_MISSING');
  });

  it('pulls only the configured root deepest leaves and flattens product specs', async () => {
    const invoke = vi.fn<FlowerTransport['invoke']>(async (_context, invocation) => {
      if (invocation.operation === FLOWER_CATEGORIES_OPERATION) return categories;
      return productPage(String(invocation.body?.cat_id3));
    });
    const ports = createFlowerPorts({ invoke, circuitState: () => 'closed' }, connection, undefined,
      () => Date.parse('2026-08-29T00:00:00.000Z'));

    const batch = await ports.catalog.pullCatalog(context);
    expect(batch).toMatchObject({ complete: false, nextCursor: '68:1', errors: [], records: [{
      externalId: '7001',
      payload: { schema: 'cakeuncle.physical-sku.v1', provider: 'flower', productId: '6001', specId: '7001',
        categoryIds: ['8', '66', '67'], amountMinor: 19800, compareMinor: 26800,
        onhand: FLOWER_UNLIMITED_ONHAND, unlimited: true },
    }] });
    expect(batch.records[0]?.version).toMatch(/^[a-f0-9]{64}$/);
    expect(invoke).toHaveBeenLastCalledWith(context, expect.objectContaining({ operation: 'flower.category.8',
      path: CAKEUNCLE_PHYSICAL_ENDPOINTS.products, idempotent: true,
      body: { page: '1', size: '200', cat_id: '8', cat_id2: '66', cat_id3: '67' } }));
  });

  it('maps strict minor-unit prices and unlimited versus finite stock', async () => {
    const invoke = vi.fn<FlowerTransport['invoke']>(async (_context, invocation) => {
      if (invocation.operation === FLOWER_CATEGORIES_OPERATION) return categories;
      return productPage(String(invocation.body?.cat_id3));
    });
    const ports = createFlowerPorts({ invoke, circuitState: () => 'closed' }, connection, undefined,
      () => Date.parse('2026-08-29T00:00:00.000Z'));

    const prices = await ports.price.pullPrice(context, [{ externalId: '7001' }, { externalId: '7002' }]);
    expect(prices.records).toEqual([
      expect.objectContaining({ externalId: '7001', amountMinor: 19800, compareMinor: 26800, currency: 'CNY' }),
      expect.objectContaining({ externalId: '7002', amountMinor: 9900, compareMinor: 12800, currency: 'CNY' }),
    ]);
    const stock = await ports.stock.pullStock(context, [{ externalId: '7001' }, { externalId: '7002' }]);
    expect(stock.records[0]).toMatchObject({ externalId: '7001', onhand: FLOWER_UNLIMITED_ONHAND, unlimited: true });
    expect(stock.records[1]).toMatchObject({ externalId: '7002', onhand: 12 });
    expect(stock.records[1]).not.toHaveProperty('unlimited');
  });

  it('rejects ambiguous scope, malformed money and undocumented negative stock', async () => {
    expect(() => flowerEndpointConfiguration({ ...connection, endpoints: {
      ...connection.endpoints, 'flower.category.5': CAKEUNCLE_PHYSICAL_ENDPOINTS.products,
    } })).toThrow('FLOWER_ROOT_CATEGORY_CONFIGURATION_INVALID');

    const malformed = (spec: JsonObject): ReturnType<typeof createFlowerPorts> => createFlowerPorts({
      circuitState: () => 'closed',
      invoke: async (_context, invocation) => invocation.operation === FLOWER_CATEGORIES_OPERATION
        ? oneLeafCategories : productPage('67', spec),
    }, connection);
    await expect(malformed({ price: '19.999' }).catalog.pullCatalog(context)).rejects.toThrow('FLOWER_SPEC_PRICE_INVALID');
    await expect(malformed({ stock: '-1' }).catalog.pullCatalog(context)).rejects.toThrow('FLOWER_SPEC_STOCK_INVALID');
  });
});

const oneLeafCategories: JsonObject = {
  code: 200, msg: 'success', data: [
    { id: '8', parent_id: '0', level: '1', name: '花' },
    { id: '66', parent_id: '8', level: '2', name: '甄选鲜花' },
    { id: '67', parent_id: '66', level: '3', name: '表达爱意' },
  ],
};

function productPage(leafId: string, overrides: JsonObject = {}): JsonObject {
  const second = leafId === '68';
  return {
    code: 200,
    msg: 'success',
    data: {
      total_num: 1,
      products: [{
        product_id: second ? '6002' : '6001',
        brand_id: '101007',
        product_name: second ? '生日花束' : '告白花束',
        brand_name: '测试花店',
        cat_id: '8',
        cat_id2: '66',
        cat_id3: leafId,
        image_path: 'https://vendor.test/flower.png',
        product_description: '指定时间段送达',
        label_name: '同城配送,当日达',
        is_greeting: '0',
        storage: '常温',
        introduce: '新鲜制作',
        expiry_days: '1',
        charges: [],
        city_ids: '2,118',
        specs: [{
          spec_id: second ? '7002' : '7001',
          spec_name: second ? '标准款' : '精选款',
          price: second ? '99.00' : '198.00',
          market_price: second ? '128.00' : '268.00',
          gift: '贺卡',
          spec_description: '含配送',
          stock: second ? '12' : '-9999999',
          tastes: '',
          clearing_price: second ? '80.00' : '149.49',
          ...overrides,
        }],
      }],
    },
  };
}
=======
import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { FlowerProvider } from '../Provider';
import { manifest } from '../manifest';

describe('flower provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('flower');
    expect(FlowerProvider.definition.id).toBe('flower');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('FLOWER_MANIFEST_SIGNATURE_MISSING');
  });
});
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
