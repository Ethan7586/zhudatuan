import { IntegrationClient, type IntegrationConnection } from '@shop/providercore';
import { createWenxuanAuth } from './Auth';

export function createWenxuanClient(connection: IntegrationConnection, fetcher?: typeof fetch): IntegrationClient {
  return new IntegrationClient(connection, createWenxuanAuth(connection.secret), fetcher);
}
