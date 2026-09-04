import { createWanlianClient } from '@shop/providerwanliancore';
import type { IntegrationConnection } from '@shop/providercore';
import { MovieConfig } from '../Config';

export function createMovieClient(connection: IntegrationConnection, fetcher?: typeof fetch) {
  return createWanlianClient(MovieConfig.validate(connection), fetcher);
}

export function checkMovieHealth(client: { health(): Promise<boolean> }): Promise<boolean> {
  return client.health();
}
