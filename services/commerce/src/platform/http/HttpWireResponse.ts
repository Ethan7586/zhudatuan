import { BrowserRequestHeaders, BrowserResponseHeaders } from '@shop/contract';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { HttpStream } from './HttpStream';

export function httpResponse(status: number, body: unknown, requestId: string, origin?: string | null, headers: Readonly<Record<string, string>> = {}, cachePolicy: string = 'none'): Response {
  const output = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'x-request-id': requestId,
    'cache-control': cachePolicy === 'etag' ? 'private, no-cache' : cachePolicy === 'private' ? 'private, no-store' : 'no-store',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'strict-transport-security': 'max-age=63072000; includeSubDomains',
    ...(origin
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          'access-control-expose-headers': BrowserResponseHeaders.join(','),
          vary: 'origin',
        }
      : {}),
  });
  for (const [name, value] of Object.entries(headers)) {
    if (name === 'x-set-cookie' || name === 'x-clear-cookie') output.append('set-cookie', value);
    else output.set(name, value);
  }
  if (status === 204 || status === 303 || status === 304) output.delete('content-type');
  const serialized = status === 204 || status === 303 || status === 304 || body === undefined ? null : JSON.stringify(body);
  if (serialized !== null && Buffer.byteLength(serialized) > RUNTIME_LIMITS.sql.maximumResponseBytes) throw new Error('RESPONSE_BODY_TOO_LARGE');
  return new Response(serialized, { status, headers: output });
}

export function httpStreamResponse(status: number, stream: HttpStream, signal: AbortSignal, requestId: string, origin?: string | null, headers: Readonly<Record<string, string>> = {}): Response {
  const output = new Headers({
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
    'x-request-id': requestId,
    'x-content-type-options': 'nosniff',
    ...(origin ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-expose-headers': BrowserResponseHeaders.join(','), vary: 'origin' } : {}),
  });
  for (const [name, value] of Object.entries(headers)) output.set(name, value);
  return new Response(stream.readable(signal), { status, headers: output });
}

export function httpPreflight(request: Request, requestId: string, origin: string | null): Response {
  if (!origin) return httpResponse(400, { code: 'ORIGIN_REQUIRED', requestId }, requestId);
  const method = request.headers.get('access-control-request-method');
  if (!method || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return httpResponse(405, { code: 'METHOD_NOT_ALLOWED', requestId }, requestId, origin);
  return httpResponse(204, undefined, requestId, origin, {
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': BrowserRequestHeaders.join(','),
    'access-control-max-age': '600',
    'access-control-allow-credentials': 'true',
  });
}
