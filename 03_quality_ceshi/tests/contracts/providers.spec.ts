import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REQUIRED_PROVIDER_IDS, type ProviderPortName } from '@shop/contract';
import { BookProvider, manifest as book } from '@shop/providerbook';
import { CakeProvider, CAKE_CATEGORIES_OPERATION, CAKE_CATEGORY_OPERATION_PREFIX, manifest as cake } from '@shop/providercake';
import { DirectchargeProvider, manifest as directcharge } from '@shop/providerdirectcharge';
import { FlowerProvider, FLOWER_CATEGORIES_OPERATION, FLOWER_CATEGORY_OPERATION_PREFIX, manifest as flower } from '@shop/providerflower';
import { FoodvoucherProvider, manifest as foodvoucher } from '@shop/providerfoodvoucher';
import { JdfreshProvider, manifest as jdfresh } from '@shop/providerjdfresh';
import { JdproductProvider, manifest as jdproduct } from '@shop/providerjdproduct';
import { MealProvider, MEAL_BRANDS, manifest as meal } from '@shop/providermeal';
import { MovieProvider, manifest as movie } from '@shop/providermovie';
import { PrivateProvider, manifest as privateManifest } from '@shop/providerprivate';
import { TmallmarketProvider, manifest as tmallmarket } from '@shop/providertmallmarket';
import { CAKEUNCLE_MEAL_BRANDS, CAKEUNCLE_PHYSICAL_ENDPOINTS } from '@shop/vendorcakeuncle';
import { providerContract, type ManifestFactory, type ProviderContractConnection } from './providers/ProviderContract';

const categoryRoot = '1';
const mealBrand = MEAL_BRANDS[0];
const mealMenuOperation = `meal.menu.${mealBrand}.contract-store`;
const cakeConnection: ProviderContractConnection = {
  endpoints: { [CAKE_CATEGORIES_OPERATION]: CAKEUNCLE_PHYSICAL_ENDPOINTS.categories,
    [`${CAKE_CATEGORY_OPERATION_PREFIX}${categoryRoot}`]: CAKEUNCLE_PHYSICAL_ENDPOINTS.products },
  healthOperation: CAKE_CATEGORIES_OPERATION,
};
const flowerConnection: ProviderContractConnection = {
  endpoints: { [FLOWER_CATEGORIES_OPERATION]: CAKEUNCLE_PHYSICAL_ENDPOINTS.categories,
    [`${FLOWER_CATEGORY_OPERATION_PREFIX}${categoryRoot}`]: CAKEUNCLE_PHYSICAL_ENDPOINTS.products },
  healthOperation: FLOWER_CATEGORIES_OPERATION,
};
const mealConnection: ProviderContractConnection = {
  endpoints: { [MealProvider.definition.healthOperation]: CAKEUNCLE_MEAL_BRANDS[mealBrand].menu,
    [mealMenuOperation]: CAKEUNCLE_MEAL_BRANDS[mealBrand].menu },
  healthOperation: MealProvider.definition.healthOperation,
};

const values: readonly [import('@shop/providercore').ProviderFactory, ManifestFactory, readonly ProviderPortName[], ProviderContractConnection?][] = [
  [JdproductProvider, jdproduct, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [JdfreshProvider, jdfresh, ['catalog', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [TmallmarketProvider, tmallmarket, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [PrivateProvider, privateManifest, ['catalog', 'stock', 'order', 'tracking', 'refund', 'statement']],
  [CakeProvider, cake, ['catalog', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement'], cakeConnection],
  [FlowerProvider, flower, ['catalog', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement'], flowerConnection],
  [BookProvider, book, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [DirectchargeProvider, directcharge, ['catalog', 'order', 'tracking', 'refund', 'statement', 'verification']],
  [FoodvoucherProvider, foodvoucher, ['catalog', 'order', 'cancel', 'refund', 'statement', 'verification']],
  [MovieProvider, movie, ['catalog', 'stock', 'order', 'cancel', 'refund', 'statement', 'verification']],
  [MealProvider, meal, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement', 'verification'], mealConnection],
];

test('all and only workbook priority-one providers have executable contracts', async () => {
  assert.deepEqual(values.map(([factory]) => factory.id).sort(), [...REQUIRED_PROVIDER_IDS].sort());
  for (const [factory, manifest, ports, connection] of values) await providerContract(factory, manifest, ports, connection);
});
