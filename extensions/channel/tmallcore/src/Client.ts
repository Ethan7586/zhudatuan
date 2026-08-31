import { IntegrationClient, type IntegrationConnection } from '@shop/providercore';
import { createTmallAuth } from './Auth';

export function createTmallClient(connection: IntegrationConnection, fetcher?: typeof fetch): IntegrationClient {
  return new IntegrationClient(connection, createTmallAuth(connection.secret), fetcher);
}
