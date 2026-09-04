import { createCakeuncleClient } from '@shop/providercakecore';
import type { IntegrationConnection } from '@shop/providercore';
import { FlowerConfig } from '../Config';

export function createFlowerClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  return createCakeuncleClient(FlowerConfig.validate(connection), fetcher);
}

export function checkFlowerHealth(client: { health(): Promise<boolean> }): Promise<boolean> {
  return client.health();
}
