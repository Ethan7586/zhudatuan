import { localIdentityInfrastructureEnvironment } from '@shop/config/server';
import { LocalHttpError, jsonBody, jsonResponse, startLocalHttps, type LocalHandler } from '../../localinfra/src/Http';
import { LocalKms } from './LocalKms';

const environment = localIdentityInfrastructureEnvironment();
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
