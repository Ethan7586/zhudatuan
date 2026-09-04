import { expect, it } from 'vitest';
import { assertProviderCatalog, assertProviderFixture } from '@shop/providercore/test';
import { CakeCatalog } from '../Catalog';
import { reserveCakeSlot } from '../capability';
import { CakeMapper } from '../integration';
import { definition } from '../Manifest';

it('maps the cake catalog fixture', () => expect(() => { assertProviderCatalog(definition, CakeCatalog); assertProviderFixture(new CakeMapper()); }).not.toThrow());

it('normalizes options, stores, service dates and slot inventory', () => {
  const [record] = new CakeMapper().objects([{ productId: 'CAKE-1', updatedAt: '2026-09-06T00:00:00Z', options: [{ name: '尺寸', value: '8寸' }], stores: ['STORE-1'], deliveryRegions: ['310115'], appointmentDates: ['2026-09-10'], blessingMaxLength: 30 }], 'fixture');
  expect(record).toMatchObject({ externalId: 'CAKE-1', payload: { stores: ['STORE-1'], blessingMaxLength: 30 } });
  expect(reserveCakeSlot(3, 2)).toBe(1);
  expect(() => reserveCakeSlot(1, 2)).toThrow('CAKE_SLOT_INVENTORY_INSUFFICIENT');
});
