import { expect, it } from 'vitest';
import { assertProviderCatalog, assertProviderFixture } from '@shop/providercore/test';
import { JdproductCatalog } from '../Catalog';
import { JdproductMapper } from '../integration';
import { definition } from '../Manifest';

it('maps the jdproduct catalog fixture', () => expect(() => { assertProviderCatalog(definition, JdproductCatalog); assertProviderFixture(new JdproductMapper()); }).not.toThrow());

it('normalizes SKU, address and fen amounts', () => {
  const [record] = new JdproductMapper().objects([{ skuId: 'JD-1', updatedAt: '2026-09-06T00:00:00Z', title: '礼盒', categoryId: 'gift', priceFen: 9900, stock: 8, address: { province: '上海市', city: '上海市', district: '浦东新区', detail: '世纪大道 1 号' } }], 'fixture');
  expect(record).toMatchObject({ externalId: 'JD-1', payload: { priceMinor: 9900, stock: 8, address: { district: '浦东新区' } } });
});
