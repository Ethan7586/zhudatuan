import { RequestExecutor, type IntegrationConnection } from '@shop/providercore';
import { createCakeuncleAuth } from './Auth';

export function createCakeuncleClient(connection: IntegrationConnection, fetcher?: typeof fetch): RequestExecutor {
  return new RequestExecutor(connection, createCakeuncleAuth(connection.secret), fetcher);
}
