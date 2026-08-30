import { localIdentityInfrastructureEnvironment } from '@shop/config/server';
import { startLocalHttps } from '../../localinfra/src/Http';
import { loadFullStagingWorkloadAccessPolicy, unrestrictedBearerAuthorization, workloadAuthorizationPreflight } from '../../localinfra/src/WorkloadAccessPolicy';
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

await startLocalHttps('localkms', environment.kmsPort, kmsHandler(kms, authorization), {
  certificateFile: environment.tlsCertificateFile,
  keyFile: environment.tlsKeyFile,
}, 9 * 1024 * 1024, workloadAuthorizationPreflight(authorization));

function required(value: string | undefined, code: string): string {
  if (value === undefined) throw new Error(code);
  return value;
}
