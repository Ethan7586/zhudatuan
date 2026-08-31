import { LocalHttpError, jsonBody, jsonResponse, requireBearerAuthorization, type LocalHandler } from '../../localinfra/src/Http';

export interface EnvelopeCipher {
  encrypt(purpose: string, keyRef: string, plaintext: string, context: Readonly<Record<string, unknown>>): unknown;
  decrypt(purpose: string, keyRef: string, ciphertext: string, context: Readonly<Record<string, unknown>>): string;
}

export function kmsHandler(kms: EnvelopeCipher, bearerToken: string): LocalHandler {
  return async (request) => {
    if (request.url.pathname === '/health/ready') {
      return request.method === 'GET' ? jsonResponse(200, { status: 'ready' }) : jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' });
    }
    requireBearerAuthorization(request.headers, bearerToken);
    if (request.method !== 'POST') return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' });
    const body = jsonBody(request);
    const context = body.context;
    const keyRef = body.keyRef;
    const purpose = body.purpose;
    if (typeof keyRef !== 'string' || typeof purpose !== 'string' || !['cachehmac', 'evidence', 'pii', 'providerconfig'].includes(purpose) || context === null || typeof context !== 'object' || Array.isArray(context)) {
      throw new LocalHttpError(400, 'KMS_REQUEST_INVALID');
    }
    if (request.url.pathname === '/v1/envelopes') {
      if (typeof body.plaintext !== 'string') throw new LocalHttpError(400, 'KMS_REQUEST_INVALID');
      return jsonResponse(200, kms.encrypt(purpose, keyRef, body.plaintext, context as Readonly<Record<string, unknown>>));
    }
    if (request.url.pathname === '/v1/plaintexts') {
      if (typeof body.ciphertext !== 'string') throw new LocalHttpError(400, 'KMS_REQUEST_INVALID');
      return jsonResponse(200, { plaintext: kms.decrypt(purpose, keyRef, body.ciphertext, context as Readonly<Record<string, unknown>>) });
    }
    return jsonResponse(404, { code: 'KMS_ROUTE_NOT_FOUND' });
  };
}
