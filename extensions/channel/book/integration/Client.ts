import { createWenxuanClient } from '@shop/providerbookcore';
import type { IntegrationConnection } from '@shop/providercore';
import { BookConfig } from '../Config';

export function createBookClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  return createWenxuanClient(BookConfig.validate(connection), fetcher);
}
