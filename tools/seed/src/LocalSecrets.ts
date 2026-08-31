import { localSecret as readLocalSecret } from '@shop/localinfra';
import { localSeedEnvironment } from '@shop/config/server';

const environment = localSeedEnvironment();

export async function localSecret(reference: string): Promise<string> {
<<<<<<< HEAD
<<<<<<< HEAD
  return readLocalSecret(environment.secretStoreEndpoint, environment.secretStoreBearerToken, reference);
=======
  return readLocalSecret(environment.secretStoreEndpoint, reference);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  return readLocalSecret(environment.secretStoreEndpoint, environment.secretStoreBearerToken, reference);
>>>>>>> 018b2a71 (chore(release): capture current production source)
}
