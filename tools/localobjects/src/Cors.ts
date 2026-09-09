import { CLIENT_LOCAL_ORIGINS } from '@shop/config/clientcatalog';
import { LocalHttpError, jsonResponse, type LocalHandler, type LocalRequest, type LocalResponse } from '../../localinfra/src/Http';

const ALLOWED_ORIGINS = new Set(Object.values(CLIENT_LOCAL_ORIGINS));
const ALLOWED_HEADERS = Object.freeze(['content-type', 'x-content-sha256', 'x-retention-until']);
const PREFLIGHT_VARY = 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers';

export function withObjectCors(handler: LocalHandler): LocalHandler {
  return async (request) => {
    const allowedMethod = publicMethod(request.url.pathname);
    if (allowedMethod === null) return handler(request);

    const origin = request.headers.origin;
    if (request.method === 'OPTIONS') return preflight(request, origin, allowedMethod);
    if (request.method !== allowedMethod) return corsError(405, 'METHOD_NOT_ALLOWED', origin);
    if (origin === undefined) return handler(request);
    authorizeOrigin(origin);

    try {
      return addCors(await handler(request), origin, 'Origin');
    } catch (cause) {
      if (cause instanceof LocalHttpError) return addCors(jsonResponse(cause.status, { code: cause.code }), origin, 'Origin');
      throw cause;
    }
  };
}

function preflight(request: LocalRequest, origin: string | undefined, allowedMethod: string): LocalResponse {
  authorizeOrigin(origin);
  const requestedMethod = request.headers['access-control-request-method']?.toUpperCase();
  if (requestedMethod !== allowedMethod) throw new LocalHttpError(405, 'CORS_METHOD_FORBIDDEN');

  const requestedHeaders = (request.headers['access-control-request-headers'] ?? '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
  if (requestedHeaders.some((header) => !ALLOWED_HEADERS.includes(header))) throw new LocalHttpError(403, 'CORS_HEADER_FORBIDDEN');

  return Object.freeze({
    status: 204,
    headers: Object.freeze({
      'access-control-allow-origin': origin,
      'access-control-allow-methods': allowedMethod,
      'access-control-allow-headers': ALLOWED_HEADERS.join(', '),
      'access-control-max-age': '600',
      vary: PREFLIGHT_VARY,
    }),
  });
}

function authorizeOrigin(origin: string | undefined): asserts origin is string {
  if (origin === undefined || !ALLOWED_ORIGINS.has(origin)) throw new LocalHttpError(403, 'CORS_ORIGIN_FORBIDDEN');
}

function publicMethod(pathname: string): 'GET' | 'PUT' | null {
  if (/^\/v1\/public\/[^/]+$/.test(pathname)) return 'GET';
  if (/^\/v1\/public-upload\/[^/]+$/.test(pathname)) return 'PUT';
  return null;
}

function corsError(status: number, code: string, origin: string | undefined): LocalResponse {
  authorizeOrigin(origin);
  return addCors(jsonResponse(status, { code }), origin, 'Origin');
}

function addCors(response: LocalResponse, origin: string, vary: string): LocalResponse {
  return Object.freeze({
    ...response,
    headers: Object.freeze({
      ...response.headers,
      'access-control-allow-origin': origin,
      'access-control-expose-headers': 'content-type',
      vary,
    }),
  });
}
