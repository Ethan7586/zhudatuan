import { createJdClient } from '@shop/providerjdcore';
import type { IntegrationConnection } from '@shop/providercore';
import { JdfreshConfig } from '../Config';

export function createJdfreshClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  return createJdClient(JdfreshConfig.validate(connection), fetcher);
}
