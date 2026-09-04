import { storeEnvironment } from '@shop/config/store';
import { createFetchSurface, type StoreSurfaceClient } from '@shop/sdk';

export interface StoreDependencies {
  readonly client: StoreSurfaceClient;
  readonly environment: ReturnType<typeof storeEnvironment>;
}

export function createStoreDependencies(): StoreDependencies {
  const environment = storeEnvironment();
  return Object.freeze({ environment, client: createFetchSurface('store', environment.apiOrigin) });
}
