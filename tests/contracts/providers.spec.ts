import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REQUIRED_PROVIDER_IDS, type ProviderPortName } from '@shop/contract';
import { BookProvider, manifest as book } from '@shop/providerbook';
import { CakeProvider, manifest as cake } from '@shop/providercake';
import { DirectchargeProvider, manifest as directcharge } from '@shop/providerdirectcharge';
import { FlowerProvider, manifest as flower } from '@shop/providerflower';
import { FoodvoucherProvider, manifest as foodvoucher } from '@shop/providerfoodvoucher';
import { JdfreshProvider, manifest as jdfresh } from '@shop/providerjdfresh';
import { JdproductProvider, manifest as jdproduct } from '@shop/providerjdproduct';
import { MealProvider, manifest as meal } from '@shop/providermeal';
import { MovieProvider, manifest as movie } from '@shop/providermovie';
import { PrivateProvider, manifest as privateManifest } from '@shop/providerprivate';
import { TmallmarketProvider, manifest as tmallmarket } from '@shop/providertmallmarket';
import { providerContract, type ManifestFactory } from './providers/ProviderContract';

const values: readonly [import('@shop/providercore').ProviderFactory, ManifestFactory, readonly ProviderPortName[]][] = [
  [JdproductProvider, jdproduct, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [JdfreshProvider, jdfresh, ['catalog', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [TmallmarketProvider, tmallmarket, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [PrivateProvider, privateManifest, ['catalog', 'stock', 'order', 'tracking', 'refund', 'statement']],
<<<<<<< HEAD
<<<<<<< HEAD
  [CakeProvider, cake, ['catalog', 'price', 'stock']],
  [FlowerProvider, flower, ['catalog', 'price', 'stock']],
  [BookProvider, book, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [DirectchargeProvider, directcharge, ['catalog', 'order', 'tracking', 'refund', 'statement', 'verification']],
  [FoodvoucherProvider, foodvoucher, ['catalog', 'price']],
  [MovieProvider, movie, ['catalog', 'stock', 'order', 'cancel', 'refund', 'statement', 'verification']],
  [MealProvider, meal, ['catalog', 'price']],
=======
  [CakeProvider, cake, ['catalog', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [FlowerProvider, flower, ['catalog', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
=======
  [CakeProvider, cake, ['catalog', 'price', 'stock']],
  [FlowerProvider, flower, ['catalog', 'price', 'stock']],
>>>>>>> 018b2a71 (chore(release): capture current production source)
  [BookProvider, book, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [DirectchargeProvider, directcharge, ['catalog', 'order', 'tracking', 'refund', 'statement', 'verification']],
  [FoodvoucherProvider, foodvoucher, ['catalog', 'price']],
  [MovieProvider, movie, ['catalog', 'stock', 'order', 'cancel', 'refund', 'statement', 'verification']],
<<<<<<< HEAD
  [MealProvider, meal, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement', 'verification']],
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  [MealProvider, meal, ['catalog', 'price']],
>>>>>>> 018b2a71 (chore(release): capture current production source)
];

test('all and only workbook priority-one providers have executable contracts', async () => {
  assert.deepEqual(values.map(([factory]) => factory.id).sort(), [...REQUIRED_PROVIDER_IDS].sort());
  for (const [factory, manifest, ports] of values) await providerContract(factory, manifest, ports);
});
