import { createWanlianClient } from '@shop/providerwanliancore';
import type { IntegrationConnection } from '@shop/providercore';
import { ChargeConfig } from '../Config';

export function createChargeClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  return createWanlianClient(ChargeConfig.validate(connection), fetcher);
}

export function checkChargeHealth(client: { health(): Promise<boolean> }): Promise<boolean> {
  return client.health();
}
