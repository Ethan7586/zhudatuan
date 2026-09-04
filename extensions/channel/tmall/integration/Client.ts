import { RequestExecutor, type IntegrationConnection } from '@shop/providercore';
import { TmallConfig } from '../Config';
import { createTmallAuth } from './Auth';

export function createTmallClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  const validated = TmallConfig.validate(connection);
  return new RequestExecutor(validated, createTmallAuth(validated.secret), fetcher);
}

export function checkTmallHealth(client: { health(): Promise<boolean> }): Promise<boolean> {
  return client.health();
}
