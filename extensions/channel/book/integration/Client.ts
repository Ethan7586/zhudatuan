import { RequestExecutor, type IntegrationConnection } from '@shop/providercore';
import { BookConfig } from '../Config';
import { createBookAuth } from './Auth';

export function createBookClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  const validated = BookConfig.validate(connection);
  return new RequestExecutor(validated, createBookAuth(validated.secret), fetcher);
}

export function checkBookHealth(client: { health(): Promise<boolean> }): Promise<boolean> {
  return client.health();
}
