import type { ProviderFactory } from '@shop/providercore';
import { BookProvider } from '@shop/providerbook';
import { CakeProvider } from '@shop/providercake';
import { DirectchargeProvider } from '@shop/providerdirectcharge';
import { FlowerProvider } from '@shop/providerflower';
import { FoodvoucherProvider } from '@shop/providerfoodvoucher';
import { JdfreshProvider } from '@shop/providerjdfresh';
import { JdproductProvider } from '@shop/providerjdproduct';
import { MealProvider } from '@shop/providermeal';
import { MovieProvider } from '@shop/providermovie';
import { PrivateProvider } from '@shop/providerprivate';
import { TmallmarketProvider } from '@shop/providertmallmarket';

export const PROVIDER_FACTORIES: readonly ProviderFactory[] = Object.freeze([
  JdproductProvider,
  JdfreshProvider,
  TmallmarketProvider,
  PrivateProvider,
  CakeProvider,
  FlowerProvider,
  BookProvider,
  DirectchargeProvider,
  FoodvoucherProvider,
  MovieProvider,
  MealProvider,
]);

export function providerFactory(id: string): ProviderFactory {
  const factory = PROVIDER_FACTORIES.find((candidate) => candidate.id === id);
  if (!factory) throw new Error(`PROVIDER_FACTORY_MISSING:${id}`);
  return factory;
}
