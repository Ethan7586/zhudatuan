import { localIdentityInfrastructureEnvironment } from '@shop/config/server';
import { startLocalHttps, workloadBearerPreflight } from '../../localinfra/src/Http';
import { secretStoreHandler } from './Handler';
import { SecretCatalog } from './SecretCatalog';

const environment = localIdentityInfrastructureEnvironment();
const catalog = await SecretCatalog.load(environment.secretsFile);
const policy = environment.workloadAccessPolicyFile === undefined
  ? undefined
  : await loadFullStagingWorkloadAccessPolicy(environment.workloadAccessPolicyFile);
const authorization = policy?.secretStore
  ?? unrestrictedBearerAuthorization(required(environment.secretStoreBearerToken, 'LOCAL_SECRET_STORE_BEARER_TOKEN_MISSING'));

await startLocalHttps('localsecrets', environment.secretsPort, secretStoreHandler(catalog, environment.secretStoreBearerToken), {
  certificateFile: environment.tlsCertificateFile,
  keyFile: environment.tlsKeyFile,
}, 1024, workloadBearerPreflight(environment.secretStoreBearerToken));
