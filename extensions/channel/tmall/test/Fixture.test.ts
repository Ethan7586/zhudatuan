import { expect, it } from 'vitest';
import { assertProviderCatalog, assertProviderFixture } from '@shop/providercore/test';
import { TmallCatalog } from '../Catalog';
import { TmallMapper } from '../integration';
import { definition } from '../Manifest';

it('maps the tmall catalog fixture', () => expect(() => { assertProviderCatalog(definition, TmallCatalog); assertProviderFixture(new TmallMapper()); }).not.toThrow());

it('normalizes item, price and inventory data', () => {
  const [record] = new TmallMapper().objects([{ itemId: 'TM-1', modifiedAt: '2026-09-06T00:00:00Z', title: '家庭装', priceCent: 12800, stock: 12 }], 'fixture');
  expect(record).toMatchObject({ externalId: 'TM-1', payload: { priceMinor: 12800, stock: 12 } });
});
