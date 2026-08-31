<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { localIdentityInfrastructureEnvironment } from '@shop/config/server';
import { startLocalHttps } from '../../localinfra/src/Http';
import { loadFullStagingWorkloadAccessPolicy, unrestrictedBearerAuthorization, workloadAuthorizationPreflight } from '../../localinfra/src/WorkloadAccessPolicy';
import { kmsHandler } from './Handler';
<<<<<<< HEAD
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
=======
import { localInfrastructureEnvironment } from '@shop/config/server';
import { LocalHttpError, jsonBody, jsonResponse, startLocalHttps, type LocalHandler } from '../../localinfra/src/Http';
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
<<<<<<< HEAD
});
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
}, 9 * 1024 * 1024, workloadAuthorizationPreflight(authorization));

function required(value: string | undefined, code: string): string {
  if (value === undefined) throw new Error(code);
  return value;
}
>>>>>>> 018b2a71 (chore(release): capture current production source)
