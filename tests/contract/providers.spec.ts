import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REQUIRED_PROVIDER_IDS, type ProviderPortName } from '@shop/contract';
import { BookProvider, manifest as book } from '@shop/providerbook';
import { CakeProvider, manifest as cake } from '@shop/providercake';
import { ChargeProvider, manifest as charge } from '@shop/providercharge';
import { FlowerProvider, manifest as flower } from '@shop/providerflower';
import { FoodvoucherProvider, manifest as foodvoucher } from '@shop/providerfoodvoucher';
import { JdfreshProvider, manifest as jdfresh } from '@shop/providerjdfresh';
import { JdproductProvider, manifest as jdproduct } from '@shop/providerjdproduct';
import { MealProvider, manifest as meal } from '@shop/providermeal';
import { MovieProvider, manifest as movie } from '@shop/providermovie';
import { SupplierProvider, manifest as supplier } from '@shop/providersupplier';
import { TmallProvider, manifest as tmall } from '@shop/providertmall';
import { providerContract, type ManifestFactory } from './providers/ProviderContract';

const values: readonly [import('@shop/providercore').ProviderFactory, ManifestFactory, readonly ProviderPortName[]][] = [
  [JdproductProvider, jdproduct, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [JdfreshProvider, jdfresh, ['catalog', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [TmallProvider, tmall, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [SupplierProvider, supplier, ['catalog', 'stock', 'order', 'tracking', 'refund', 'statement']],
  [CakeProvider, cake, ['catalog', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [FlowerProvider, flower, ['catalog', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [BookProvider, book, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement']],
  [ChargeProvider, charge, ['catalog', 'order', 'tracking', 'refund', 'statement', 'verification']],
  [FoodvoucherProvider, foodvoucher, ['catalog', 'order', 'cancel', 'refund', 'statement', 'verification']],
  [MovieProvider, movie, ['catalog', 'stock', 'order', 'cancel', 'refund', 'statement', 'verification']],
  [MealProvider, meal, ['catalog', 'price', 'stock', 'order', 'cancel', 'tracking', 'refund', 'statement', 'verification']],
];

test('all and only workbook priority-one providers have executable contracts', async () => {
  assert.deepEqual(values.map(([factory]) => factory.id).sort(), [...REQUIRED_PROVIDER_IDS].sort());
  for (const [factory, manifest, ports] of values) await providerContract(factory, manifest, ports);
});
