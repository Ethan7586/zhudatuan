import { expect, it } from 'vitest';
import { assertProviderCatalog, assertProviderFixture } from '@shop/providercore/test';
import { JdfreshCatalog } from '../Catalog';
import { JdfreshMapper } from '../integration';
import { definition } from '../Manifest';

it('maps the jdfresh catalog fixture', () => expect(() => { assertProviderCatalog(definition, JdfreshCatalog); assertProviderFixture(new JdfreshMapper()); }).not.toThrow());

it('normalizes weight, temperature, slot, region and substitution data', () => {
  const [record] = new JdfreshMapper().objects([{ skuId: 'FRESH-1', updatedAt: '2026-09-06T00:00:00Z', weightGram: 500, temperatureBand: 'chilled', deliverySlots: ['09:00-11:00'], regions: ['310115'], substitutes: ['FRESH-2'] }], 'fixture');
  expect(record).toMatchObject({ externalId: 'FRESH-1', payload: { weightGram: 500, temperatureBand: 'chilled', substitutes: ['FRESH-2'] } });
});
