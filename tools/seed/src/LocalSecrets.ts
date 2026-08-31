import { localSecret as readLocalSecret } from '@shop/localinfra';
import { localSeedEnvironment } from '@shop/config/server';

const environment = localSeedEnvironment();

export async function localSecret(reference: string): Promise<string> {
  return readLocalSecret(environment.secretStoreEndpoint, environment.secretStoreBearerToken, reference);
}
