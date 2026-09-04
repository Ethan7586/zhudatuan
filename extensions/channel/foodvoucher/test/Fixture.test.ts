import { expect, it } from 'vitest';
import { assertProviderCatalog, assertProviderFixture } from '@shop/providercore/test';
import { FoodvoucherCatalog } from '../Catalog';
import { FOODVOUCHER_ACCESS_SCOPE } from '../capability';
import { FoodvoucherMapper } from '../integration';
import { definition } from '../Manifest';

it('maps the foodvoucher catalog fixture', () => expect(() => { assertProviderCatalog(definition, FoodvoucherCatalog); assertProviderFixture(new FoodvoucherMapper()); }).not.toThrow());

it('normalizes store scope and e-code lifecycle without platform Voucher authority', () => {
  const [record] = new FoodvoucherMapper().objects([{ voucherProductId: 'FOOD-1', updatedAt: '2026-09-06T00:00:00Z', storeIds: ['STORE-1'], codeReference: 'secretref://food/code-1', codeState: 'issued' }], 'fixture');
  expect(record).toMatchObject({ externalId: 'FOOD-1', payload: { stores: ['STORE-1'], codeState: 'issued' } });
  expect(FOODVOUCHER_ACCESS_SCOPE).toBe('channel.foodvoucher');
  expect(definition.permissions.some((permission) => permission.startsWith('voucher.'))).toBe(false);
});
