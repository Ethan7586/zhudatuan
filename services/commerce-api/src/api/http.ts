export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export function json(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('cross-origin-resource-policy', 'same-site');
  headers.set('permissions-policy', 'camera=(), geolocation=(), microphone=()');
  const requestId = readRequestId(value);
  if (requestId) headers.set('x-request-id', requestId);
  return new Response(JSON.stringify(value), { ...init, headers });
}

export function apiError(status: number, code: string, message: string, requestId: string, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('x-request-id', requestId);
  return json({ error: { code, message, requestId } } satisfies ApiErrorBody, { status, headers: responseHeaders });
}

export function methodNotAllowed(allowed: string[], requestId: string): Response {
  return apiError(405, 'METHOD_NOT_ALLOWED', '请求方法不受支持', requestId, {
    Allow: allowed.join(', '),
  });
}

function readRequestId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const requestId = (value as Record<string, unknown>).requestId;
  return typeof requestId === 'string' && requestId.length > 0 ? requestId : null;
}
