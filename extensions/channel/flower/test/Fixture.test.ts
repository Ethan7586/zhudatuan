import { expect, it } from 'vitest';
import { assertProviderCatalog, assertProviderFixture } from '@shop/providercore/test';
import { FlowerCatalog } from '../Catalog';
import { flowerAvailability } from '../capability';
import { FlowerMapper } from '../integration';
import { definition } from '../Manifest';

it('maps the flower catalog fixture', () => expect(() => { assertProviderCatalog(definition, FlowerCatalog); assertProviderFixture(new FlowerMapper()); }).not.toThrow());

it('keeps flower mapping independent and applies holiday substitution policy', () => {
  const [record] = new FlowerMapper().objects([{ flowerId: 'FLOWER-1', updatedAt: '2026-09-06T00:00:00Z', materials: ['玫瑰'], cities: ['上海'], deliveryDates: ['2026-09-10'], cardMaxLength: 80, deliveryState: 'scheduled' }], 'fixture');
  expect(record).toMatchObject({ externalId: 'FLOWER-1', payload: { materials: ['玫瑰'], cardMaxLength: 80 } });
  expect(flowerAvailability({ holiday: true, ordinaryLimit: 20, holidayLimit: 5, available: false, sku: 'FLOWER-1', substitutes: ['FLOWER-2'] })).toEqual({ requestsPerSecond: 5, sku: 'FLOWER-2', substituted: true });
});
