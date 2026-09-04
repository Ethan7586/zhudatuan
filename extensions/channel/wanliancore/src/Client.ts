import { RequestExecutor, type IntegrationConnection } from '@shop/providercore';
import { createWanlianAuth } from './Auth';

export function createWanlianClient(connection: IntegrationConnection, fetcher?: typeof fetch): RequestExecutor {
  return new RequestExecutor(connection, createWanlianAuth(connection.secret), fetcher);
}
