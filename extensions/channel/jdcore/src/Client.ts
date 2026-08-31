import { IntegrationClient, type IntegrationConnection } from '@shop/providercore';
import { createJdAuth } from './Auth';

export function createJdClient(connection: IntegrationConnection, fetcher?: typeof fetch): IntegrationClient {
  return new IntegrationClient(connection, createJdAuth(connection.secret), fetcher);
}
