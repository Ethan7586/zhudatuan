import { createCakeuncleClient } from '@shop/providercakecore';
import type { IntegrationConnection } from '@shop/providercore';
import { FoodvoucherConfig } from '../Config';

export function createFoodvoucherClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  return createCakeuncleClient(FoodvoucherConfig.validate(connection), fetcher);
}

export function checkFoodvoucherHealth(client: { health(): Promise<boolean> }): Promise<boolean> {
  return client.health();
}
