import { localIdentityInfrastructureEnvironment } from '@shop/config/server';
import { startLocalHttps, workloadBearerPreflight } from '../../localinfra/src/Http';
import { kmsHandler } from './Handler';
import { LocalKms } from './LocalKms';

const environment = localIdentityInfrastructureEnvironment();
const kms = new LocalKms(environment.kmsMasterKey);
const policy = environment.workloadAccessPolicyFile === undefined
  ? undefined
  : await loadFullStagingWorkloadAccessPolicy(environment.workloadAccessPolicyFile);
if (policy !== undefined && environment.objectsToken !== undefined) policy.assertTokenNotReused(environment.objectsToken);
const authorization = policy?.kms
  ?? unrestrictedBearerAuthorization(required(environment.kmsBearerToken, 'LOCAL_KMS_BEARER_TOKEN_MISSING'));

await startLocalHttps('localkms', environment.kmsPort, kmsHandler(kms, environment.kmsBearerToken), {
  certificateFile: environment.tlsCertificateFile,
  keyFile: environment.tlsKeyFile,
}, 9 * 1024 * 1024, workloadBearerPreflight(environment.kmsBearerToken));
