import { IntegrationClient, type IntegrationConnection } from '@shop/providercore';
import { createCakeuncleAuth } from './Auth';

export function createCakeuncleClient(connection: IntegrationConnection, fetcher?: typeof fetch): IntegrationClient {
  return new IntegrationClient(connection, createCakeuncleAuth(connection.secret), fetcher);
}
