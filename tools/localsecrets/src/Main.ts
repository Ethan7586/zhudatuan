import { localIdentityInfrastructureEnvironment } from '@shop/config/server';
import { startLocalHttps, workloadBearerPreflight } from '../../localinfra/src/Http';
import { secretStoreHandler } from './Handler';
import { SecretCatalog } from './SecretCatalog';

const environment = localIdentityInfrastructureEnvironment();
const catalog = await SecretCatalog.load(environment.secretsFile);

await startLocalHttps('localsecrets', environment.secretsPort, secretStoreHandler(catalog, environment.secretStoreBearerToken), {
  certificateFile: environment.tlsCertificateFile,
  keyFile: environment.tlsKeyFile,
}, 1024, workloadBearerPreflight(environment.secretStoreBearerToken));
