import { createJdClient } from '@shop/providerjdcore';
import type { IntegrationConnection } from '@shop/providercore';
import { JdproductConfig } from '../Config';

export function createJdproductClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  return createJdClient(JdproductConfig.validate(connection), fetcher);
}

export function checkJdproductHealth(client: { health(): Promise<boolean> }): Promise<boolean> {
  return client.health();
}
