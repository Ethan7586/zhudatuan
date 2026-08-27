<<<<<<< HEAD
import { localIdentityInfrastructureEnvironment } from '@shop/config/server';
import { startLocalHttps } from '../../localinfra/src/Http';
import { loadFullStagingWorkloadAccessPolicy, unrestrictedBearerAuthorization, workloadAuthorizationPreflight } from '../../localinfra/src/WorkloadAccessPolicy';
import { secretStoreHandler } from './Handler';
import { SecretCatalog } from './SecretCatalog';

const environment = localIdentityInfrastructureEnvironment();
const catalog = await SecretCatalog.load(environment.secretsFile);
const policy = environment.workloadAccessPolicyFile === undefined
  ? undefined
  : await loadFullStagingWorkloadAccessPolicy(environment.workloadAccessPolicyFile);
const authorization = policy?.secretStore
  ?? unrestrictedBearerAuthorization(required(environment.secretStoreBearerToken, 'LOCAL_SECRET_STORE_BEARER_TOKEN_MISSING'));

await startLocalHttps('localsecrets', environment.secretsPort, secretStoreHandler(catalog, authorization), {
  certificateFile: environment.tlsCertificateFile,
  keyFile: environment.tlsKeyFile,
}, 1024, workloadAuthorizationPreflight(authorization));

function required(value: string | undefined, code: string): string {
  if (value === undefined) throw new Error(code);
  return value;
}
=======
import { localInfrastructureEnvironment } from '@shop/config/server';
import { jsonResponse, startLocalHttps, type LocalHandler } from '../../localinfra/src/Http';
import { SecretCatalog } from './SecretCatalog';

const environment = localInfrastructureEnvironment();
const catalog = await SecretCatalog.load(environment.secretsFile);

const handler: LocalHandler = async request => {
  if (request.url.pathname === '/health/ready') {
    return request.method === 'GET' ? jsonResponse(200, { status: 'ready' }) : jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' });
  }
  const match = /^\/v1\/secrets\/([^/]+)$/.exec(request.url.pathname);
  if (!match) return jsonResponse(404, { code: 'SECRET_NOT_FOUND' });
  if (request.method !== 'GET') return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' });
  let reference: string;
  try { reference = decodeURIComponent(match[1] ?? ''); }
  catch { return jsonResponse(404, { code: 'SECRET_NOT_FOUND' }); }
  const value = catalog.get(reference);
  return value === undefined ? jsonResponse(404, { code: 'SECRET_NOT_FOUND' }) : jsonResponse(200, { value });
};

await startLocalHttps('localsecrets', environment.secretsPort, handler, {
  certificateFile: environment.tlsCertificateFile,
  keyFile: environment.tlsKeyFile,
}, 1024);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
