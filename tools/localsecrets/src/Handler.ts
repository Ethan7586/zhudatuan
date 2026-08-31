import { createHash } from 'node:crypto';
import { jsonResponse, requireBearerAuthorization, type LocalHandler } from '../../localinfra/src/Http';

export interface SecretReader {
  get(reference: string): string | undefined;
}

export function secretStoreHandler(catalog: SecretReader, bearerToken: string): LocalHandler {
  return async (request) => {
    if (request.url.pathname === '/health/ready') {
      return request.method === 'GET' ? jsonResponse(200, { status: 'ready' }) : jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' });
    }
    requireBearerAuthorization(request.headers, bearerToken);
    const match = /^\/v1\/secrets\/([^/]+)$/.exec(request.url.pathname);
    if (!match) return jsonResponse(404, { code: 'SECRET_NOT_FOUND' });
    if (request.method !== 'GET') return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' });
    let reference: string;
    try {
      reference = decodeURIComponent(match[1] ?? '');
    } catch {
      return jsonResponse(404, { code: 'SECRET_NOT_FOUND' });
    }
    const value = catalog.get(reference);
    return value === undefined ? jsonResponse(404, { code: 'SECRET_NOT_FOUND' }) : jsonResponse(200, { value, version: createHash('sha256').update(value).digest('hex'), expiresAt: null });
  };
}
