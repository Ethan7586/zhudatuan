import { IntegrationClient, type IntegrationConnection } from '@shop/providercore';
import { createWanlianAuth } from './Auth';

export function createWanlianClient(connection: IntegrationConnection, fetcher?: typeof fetch): IntegrationClient {
  return new IntegrationClient(connection, createWanlianAuth(connection.secret), fetcher);
}
