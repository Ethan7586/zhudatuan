<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PROVIDER_IDS, type JsonObject, type ProviderCallContext } from '@shop/contract';
import { STANDARD_PROVIDER_LIMITS } from '@shop/providercore';
import { CAKEUNCLE_VOUCHER_ENDPOINTS } from '@shop/vendorcakeuncle';
import { FoodvoucherProvider, createFoodvoucherPorts, type FoodvoucherClient } from '../Provider';
<<<<<<< HEAD
import { manifest } from '../manifest';

const context: ProviderCallContext = {
  tenantId: 'tenant:test', requestId: 'request:test', traceId: 'trace:test', deadline: Date.now() + 5_000,
};

const response: JsonObject = {
  code: '200',
  msg: '获取成功',
  data: [{ servicetype: 1, type: 1001, name: '咖啡兑换券', price: '18.50', retailprice: '20.00',
    image: 'https://vendor.test/voucher.png', details_path: 'https://vendor.test/voucher', instructions: '兑换规则',
    brand_logo: 'https://vendor.test/brand.png', citys: '全国', brand: '测试品牌' }],
};

describe('foodvoucher provider contract', () => {
  it('exposes only the safe read-only capabilities and ports', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('foodvoucher');
    const signed = manifest('signed');
    expect(signed).toMatchObject({ version: '1.1.0', contractVersion: 'foodvoucher.v2',
      capabilities: ['Catalog', 'Price'], secretRefs: ['channelNo', 'channelKey'], eventSubscriptions: [] });
    const provider = FoodvoucherProvider.create({ manifest: signed, connection: {
      id: 'foodvoucher:sandbox', baseUrl: 'https://vendor.test', secret: { channelNo: 'channel-test', channelKey: 'key-test' },
      endpoints: { health: CAKEUNCLE_VOUCHER_ENDPOINTS.products }, healthOperation: 'health', limits: STANDARD_PROVIDER_LIMITS,
    } });
    expect(provider.has('catalog')).toBe(true);
    expect(provider.has('price')).toBe(true);
    expect(provider.has('order')).toBe(false);
    expect(provider.has('webhook')).toBe(false);
    expect(() => manifest('')).toThrow('FOODVOUCHER_MANIFEST_SIGNATURE_MISSING');
  });

  it('maps the official product response into catalog and price records', async () => {
    const invoke = vi.fn<FoodvoucherClient['invoke']>(async () => response);
    const ports = createFoodvoucherPorts({ invoke });

    const catalog = await ports.catalog.pullCatalog(context);
    expect(catalog).toMatchObject({ complete: true, errors: [], records: [{ externalId: '1001',
      payload: { servicetype: 1, type: 1001, name: '咖啡兑换券', price: '18.50' } }] });
    expect(catalog.records[0]?.version).toMatch(/^[a-f0-9]{64}$/);

    const prices = await ports.price.pullPrice(context, [{ externalId: '1001' }, { externalId: 'missing' }]);
    expect(prices.records).toHaveLength(1);
    expect(prices.records[0]?.externalId).toBe('1001');
    expect(prices.records[0]?.version).toBe(catalog.records[0]?.version);
    expect(prices.records[0]?.amountMinor).toBe(1850);
    expect(prices.records[0]?.compareMinor).toBe(2000);
    expect(prices.records[0]?.payload).toMatchObject({ retailprice: '20.00' });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenLastCalledWith(context, expect.objectContaining({ operation: 'foodvoucher.products',
      path: CAKEUNCLE_VOUCHER_ENDPOINTS.products, method: 'POST', body: {}, idempotent: true }));
  });

  it('rejects undocumented pagination and malformed official fields', async () => {
    const valid = createFoodvoucherPorts({ invoke: async () => response });
    await expect(valid.catalog.pullCatalog(context, 'next')).rejects.toThrow('FOODVOUCHER_CURSOR_UNSUPPORTED');

    const item = (response.data as readonly JsonObject[])[0]!;
    const malformed = createFoodvoucherPorts({ invoke: async () => ({ ...response, data: [{ ...item, price: 18.5 }] }) });
    await expect(malformed.catalog.pullCatalog(context)).rejects.toThrow('FOODVOUCHER_PRICE_INVALID');
  });
=======
import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { FoodvoucherProvider } from '../Provider';
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { manifest } from '../manifest';

const context: ProviderCallContext = {
  tenantId: 'tenant:test', requestId: 'request:test', traceId: 'trace:test', deadline: Date.now() + 5_000,
};

const response: JsonObject = {
  code: '200',
  msg: '获取成功',
  data: [{ servicetype: 1, type: 1001, name: '咖啡兑换券', price: '18.50', retailprice: '20.00',
    image: 'https://vendor.test/voucher.png', details_path: 'https://vendor.test/voucher', instructions: '兑换规则',
    brand_logo: 'https://vendor.test/brand.png', citys: '全国', brand: '测试品牌' }],
};

describe('foodvoucher provider contract', () => {
  it('exposes only the safe read-only capabilities and ports', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('foodvoucher');
    const signed = manifest('signed');
    expect(signed).toMatchObject({ version: '1.1.0', contractVersion: 'foodvoucher.v2',
      capabilities: ['Catalog', 'Price'], secretRefs: ['channelNo', 'channelKey'], eventSubscriptions: [] });
    const provider = FoodvoucherProvider.create({ manifest: signed, connection: {
      id: 'foodvoucher:sandbox', baseUrl: 'https://vendor.test', secret: { channelNo: 'channel-test', channelKey: 'key-test' },
      endpoints: { health: CAKEUNCLE_VOUCHER_ENDPOINTS.products }, healthOperation: 'health', limits: STANDARD_PROVIDER_LIMITS,
    } });
    expect(provider.has('catalog')).toBe(true);
    expect(provider.has('price')).toBe(true);
    expect(provider.has('order')).toBe(false);
    expect(provider.has('webhook')).toBe(false);
    expect(() => manifest('')).toThrow('FOODVOUCHER_MANIFEST_SIGNATURE_MISSING');
  });
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======

  it('maps the official product response into catalog and price records', async () => {
    const invoke = vi.fn<FoodvoucherClient['invoke']>(async () => response);
    const ports = createFoodvoucherPorts({ invoke });

    const catalog = await ports.catalog.pullCatalog(context);
    expect(catalog).toMatchObject({ complete: true, errors: [], records: [{ externalId: '1001',
      payload: { servicetype: 1, type: 1001, name: '咖啡兑换券', price: '18.50' } }] });
    expect(catalog.records[0]?.version).toMatch(/^[a-f0-9]{64}$/);

    const prices = await ports.price.pullPrice(context, [{ externalId: '1001' }, { externalId: 'missing' }]);
    expect(prices.records).toHaveLength(1);
    expect(prices.records[0]?.externalId).toBe('1001');
    expect(prices.records[0]?.version).toBe(catalog.records[0]?.version);
    expect(prices.records[0]?.amountMinor).toBe(1850);
    expect(prices.records[0]?.compareMinor).toBe(2000);
    expect(prices.records[0]?.payload).toMatchObject({ retailprice: '20.00' });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenLastCalledWith(context, expect.objectContaining({ operation: 'foodvoucher.products',
      path: CAKEUNCLE_VOUCHER_ENDPOINTS.products, method: 'POST', body: {}, idempotent: true }));
  });

  it('rejects undocumented pagination and malformed official fields', async () => {
    const valid = createFoodvoucherPorts({ invoke: async () => response });
    await expect(valid.catalog.pullCatalog(context, 'next')).rejects.toThrow('FOODVOUCHER_CURSOR_UNSUPPORTED');

    const item = (response.data as readonly JsonObject[])[0]!;
    const malformed = createFoodvoucherPorts({ invoke: async () => ({ ...response, data: [{ ...item, price: 18.5 }] }) });
    await expect(malformed.catalog.pullCatalog(context)).rejects.toThrow('FOODVOUCHER_PRICE_INVALID');
  });
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { FoodvoucherProvider } from '../Provider';
import { manifest } from '../manifest';

describe('foodvoucher provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('foodvoucher');
    expect(FoodvoucherProvider.definition.id).toBe('foodvoucher');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('FOODVOUCHER_MANIFEST_SIGNATURE_MISSING');
  });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
});
