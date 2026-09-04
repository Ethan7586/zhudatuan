import { RequestExecutor, type IntegrationConnection } from '@shop/providercore';
import { createJdAuth } from './Auth';

export function createJdClient(connection: IntegrationConnection, fetcher?: typeof fetch): RequestExecutor {
  return new RequestExecutor(connection, createJdAuth(connection.secret), fetcher);
}
