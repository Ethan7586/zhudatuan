import { createCakeuncleClient } from '@shop/providercakecore';
import type { IntegrationConnection } from '@shop/providercore';
import { CakeConfig } from '../Config';

export function createCakeClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  return createCakeuncleClient(CakeConfig.validate(connection), fetcher);
}

export function checkCakeHealth(client: { health(): Promise<boolean> }): Promise<boolean> {
  return client.health();
}
