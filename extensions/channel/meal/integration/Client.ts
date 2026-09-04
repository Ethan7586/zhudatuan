import { createCakeuncleClient } from '@shop/providercakecore';
import type { IntegrationConnection } from '@shop/providercore';
import { MealConfig } from '../Config';

export function createMealClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  return createCakeuncleClient(MealConfig.validate(connection), fetcher);
}

export function checkMealHealth(client: { health(): Promise<boolean> }): Promise<boolean> {
  return client.health();
}
