import { expect, it } from 'vitest';
import { assertProviderCatalog, assertProviderFixture } from '@shop/providercore/test';
import { MealCatalog } from '../Catalog';
import { validateMealSlot } from '../capability';
import { MealMapper } from '../integration';
import { definition } from '../Manifest';

it('maps the meal catalog fixture', () => expect(() => { assertProviderCatalog(definition, MealCatalog); assertProviderFixture(new MealMapper()); }).not.toThrow());

it('normalizes set composition, store slot and credential state', () => {
  const components = [{ sku: 'BURGER-1', quantity: 1 }, { sku: 'DRINK-1', quantity: 1 }];
  const [record] = new MealMapper().objects([{ setId: 'MEAL-1', updatedAt: '2026-09-06T00:00:00Z', brand: 'KFC', storeId: 'STORE-1', components, appointmentSlots: ['12:00-12:30'], credentialState: 'issued' }], 'fixture');
  expect(record).toMatchObject({ externalId: 'MEAL-1', payload: { brand: 'KFC', storeId: 'STORE-1', components } });
  expect(() => validateMealSlot({ components, remaining: 1 })).not.toThrow();
  expect(() => validateMealSlot({ components: [], remaining: 1 })).toThrow('MEAL_COMPOSITION_INVALID');
});
