import { describe, expect, it } from 'vitest';
import type { JsonObject, ProviderCallContext } from '@shop/contract';
import type { CakeuncleInvocation } from '@shop/vendorcakeuncle';
import { CakeReadClient, type CakeuncleTransport } from '../CakeuncleClient';
import { CAKEUNCLE_UNLIMITED_ONHAND } from '../Mapper';

const context: ProviderCallContext = {
  tenantId: 'tenant-test',
  requestId: 'request-test',
  traceId: 'trace-test',
  deadline: Date.now() + 60_000,
};

describe('cake read ports', () => {
  it('walks the deepest category leaf and maps each spec to a strict canonical record', async () => {
    const transport = new MockTransport();
    const client = new CakeReadClient(transport, { categoryOperation: 'cake.category.1', rootCategoryId: '1' }, 1_000,
      () => Date.parse('2026-08-29T00:00:00.000Z'));

    const batch = await client.pullCatalog(context);

    expect(batch.records).toHaveLength(2);
    expect(batch.records[0]).toMatchObject({ externalId: '1001', payload: {
      schema: 'cakeuncle.physical-sku.v1', provider: 'cake', productId: '100', specId: '1001',
      description: '商品描述',
      imagePaths: expect.arrayContaining(['https://img.dangaoss.com/product.jpg']),
      amountMinor: 9990, compareMinor: 12900, onhand: CAKEUNCLE_UNLIMITED_ONHAND, unlimited: true,
      supportsGreeting: true,
    } });
    expect(batch.records[0]?.version).toMatch(/^[a-f0-9]{64}$/);
    expect(batch.nextCursor).toBe('4:1');
    expect(transport.invocations[1]?.body).toEqual({ page: '1', size: '200', cat_id: '1', cat_id2: '2', cat_id3: '3' });
  });

  it('builds price and stock batches only for requested spec keys and caps official unlimited stock', async () => {
    const client = new CakeReadClient(new MockTransport(), { categoryOperation: 'cake.category.1', rootCategoryId: '1' }, 1_000,
      () => Date.parse('2026-08-29T00:00:00.000Z'));

    await expect(client.pullPrice(context, [{ externalId: '1001' }])).resolves.toEqual({ records: [{
      externalId: '1001', amountMinor: 9990, compareMinor: 12900, currency: 'CNY',
      version: expect.stringMatching(/^[a-f0-9]{64}$/), effectiveAt: '2026-08-29T00:00:00.000Z',
    }] });
    await expect(client.pullStock(context, [{ externalId: '1001' }, { externalId: '1002' }])).resolves.toEqual({ records: [
      { externalId: '1001', onhand: CAKEUNCLE_UNLIMITED_ONHAND, safety: 0,
        version: expect.stringMatching(/^[a-f0-9]{64}$/), observedAt: '2026-08-29T00:00:00.000Z', unlimited: true },
      { externalId: '1002', onhand: 0, safety: 0,
        version: expect.stringMatching(/^[a-f0-9]{64}$/), observedAt: '2026-08-29T00:00:00.000Z' },
    ] });
    await expect(client.pullStock(context, [{ externalId: '9999' }])).resolves.toEqual({ records: [{
      externalId: '9999', onhand: 0, safety: 0, version: expect.stringMatching(/^[a-f0-9]{64}$/),
      observedAt: '2026-08-29T00:00:00.000Z', missing: true,
    }] });
  });

  it('fails closed for undocumented negative inventory', async () => {
    const transport = new MockTransport('-1');
    const client = new CakeReadClient(transport, { categoryOperation: 'cake.category.1', rootCategoryId: '1' });
    await expect(client.pullCatalog(context)).rejects.toThrow('CAKE_SPEC_STOCK_INVALID');
  });

  it('keeps the sale price and omits a supplier market price that is lower than it', async () => {
    const client = new CakeReadClient(new MockTransport('-9999999', '90.00'),
      { categoryOperation: 'cake.category.1', rootCategoryId: '1' });
    const batch = await client.pullCatalog(context);
    expect(batch.records[0]?.payload).toMatchObject({ amountMinor: 9990 });
    expect(batch.records[0]?.payload).not.toHaveProperty('compareMinor');
  });
});

class MockTransport implements CakeuncleTransport {
  readonly invocations: CakeuncleInvocation[] = [];
  constructor(private readonly firstStock = '-9999999', private readonly firstMarketPrice = '129.00') {}

  invoke(_context: ProviderCallContext, invocation: CakeuncleInvocation): Promise<JsonObject> {
    this.invocations.push(invocation);
    if (invocation.operation === 'cake.categories') return Promise.resolve(categoriesResponse);
    const leaf = invocation.body?.cat_id3;
    if (leaf === '3') return Promise.resolve(productsResponse(this.firstStock, this.firstMarketPrice));
    if (leaf === '4') return Promise.resolve({ code: '200', msg: 'ok', data: { total_num: '0', products: [] } });
    throw new Error('UNEXPECTED_INVOCATION');
  }

  circuitState(): 'closed' { return 'closed'; }
}

const categoriesResponse: JsonObject = {
  code: '200',
  msg: 'ok',
  data: [
    { id: '1', parent_id: '0', level: '1', name: '受控根分类' },
    { id: '2', parent_id: '1', level: '2', name: '二级分类' },
    { id: '3', parent_id: '2', level: '3', name: '叶分类 A' },
    { id: '4', parent_id: '2', level: '3', name: '叶分类 B' },
    { id: '8', parent_id: '0', level: '1', name: '其他根分类' },
  ],
};

function productsResponse(firstStock: string, firstMarketPrice = '129.00'): JsonObject {
  return {
    code: '200',
    msg: 'ok',
    data: {
      total_num: 1,
      products: [{
        product_id: '100',
        brand_id: '10',
        product_name: '生日蛋糕',
        brand_name: '测试品牌',
        cat_id: '1',
        cat_id2: '2',
        cat_id3: '3',
        image_path: 'http://img.dangaoss.com/product.jpg',
        product_description: '商品描述',
        label_name: '生日,同城',
        is_greeting: '0',
        storage: '冷藏',
        introduce: '商品介绍',
        expiry_days: '2',
        city_ids: '310000,110000',
        charges: [],
        carousel_image: { m_path: 'https://img.test/m.jpg', l_path: '', s_path: '' },
        detail_image: { m_path: '', l_path: '', s_path: '' },
        specs: [
          { spec_id: '1001', spec_name: '六寸', price: '99.90', market_price: firstMarketPrice, gift: '',
            spec_description: '六寸规格', stock: firstStock, tastes: '奶油,巧克力', clearing_price: '80.00',
            spec_img: 'https://img.test/spec-1.jpg' },
          { spec_id: '1002', spec_name: '八寸', price: '159.00', market_price: '199.00', gift: '',
            spec_description: '八寸规格', stock: '0', tastes: '', clearing_price: '130.00' },
        ],
      }],
    },
  };
}
