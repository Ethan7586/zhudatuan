<<<<<<< HEAD
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
=======
import { localInfrastructureEnvironment } from '@shop/config/server';
import { LocalHttpError, jsonBody, jsonResponse, startLocalHttps, type LocalHandler } from '../../localinfra/src/Http';
import { LocalKms } from './LocalKms';

const environment = localInfrastructureEnvironment();
const kms = new LocalKms(environment.kmsMasterKey);

const handler: LocalHandler = async request => {
  if (request.url.pathname === '/health/ready') {
    return request.method === 'GET' ? jsonResponse(200, { status: 'ready' }) : jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' });
  }
  if (request.method !== 'POST') return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' });
  const body = jsonBody(request);
  const context = body.context;
  const keyRef = body.keyRef;
  if (typeof keyRef !== 'string' || context === null || typeof context !== 'object' || Array.isArray(context)) {
    throw new LocalHttpError(400, 'KMS_REQUEST_INVALID');
  }
  if (request.url.pathname === '/v1/envelopes') {
    if (typeof body.plaintext !== 'string') throw new LocalHttpError(400, 'KMS_REQUEST_INVALID');
    return jsonResponse(200, kms.encrypt(keyRef, body.plaintext, context as Readonly<Record<string, unknown>>));
  }
  if (request.url.pathname === '/v1/plaintexts') {
    if (typeof body.ciphertext !== 'string') throw new LocalHttpError(400, 'KMS_REQUEST_INVALID');
    return jsonResponse(200, { plaintext: kms.decrypt(keyRef, body.ciphertext, context as Readonly<Record<string, unknown>>) });
  }
  return jsonResponse(404, { code: 'KMS_ROUTE_NOT_FOUND' });
};

await startLocalHttps('localkms', environment.kmsPort, handler, {
  certificateFile: environment.tlsCertificateFile,
  keyFile: environment.tlsKeyFile,
});
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
