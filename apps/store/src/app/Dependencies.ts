import { storeEnvironment } from '@shop/config/store';
import type { StoreSurfaceClient } from '@shop/sdk/surfaces';
import { createFetchStore } from '@shop/sdk/storeclient';

export interface StoreDependencies {
  readonly client: StoreSurfaceClient;
  readonly environment: ReturnType<typeof storeEnvironment>;
}

export function createStoreDependencies(): StoreDependencies {
  const environment = storeEnvironment();
  return Object.freeze({ environment, client: createFetchStore(environment.apiOrigin) });
}
