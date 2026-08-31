import { createTmallClient as createTmallTransport } from '@shop/providertmallcore';
import type { IntegrationConnection } from '@shop/providercore';
import { TmallConfig } from '../Config';

export function createTmallClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  return createTmallTransport(TmallConfig.validate(connection), fetcher);
}
