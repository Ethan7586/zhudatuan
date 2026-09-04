import { expect, it } from 'vitest';
import { assertProviderCatalog, assertProviderFixture } from '@shop/providercore/test';
import { ChargeCatalog } from '../Catalog';
import { ChargeMapper, normalizeChargeResult, validateChargeNumber } from '../integration';
import { definition } from '../Manifest';

it('maps the charge catalog fixture', () => expect(() => { assertProviderCatalog(definition, ChargeCatalog); assertProviderFixture(new ChargeMapper()); }).not.toThrow());

it('normalizes phone and fuel products and recovers unknown outcomes by query', () => {
  const [record] = new ChargeMapper().objects([{ tradeNo: 'CHARGE-1', updatedAt: '2026-09-06T00:00:00Z', kind: 'phone', denominationCent: 10000, targetExample: '13800138000' }], 'fixture');
  expect(record).toMatchObject({ externalId: 'CHARGE-1', payload: { kind: 'phone', denominationMinor: 10000 } });
  expect(validateChargeNumber('fuel', '12345678')).toBe('12345678');
  expect(normalizeChargeResult('UNRECOGNIZED')).toEqual({ state: 'unknown', recoverByQuery: true });
});
