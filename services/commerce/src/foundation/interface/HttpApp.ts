import { randomUUID } from 'node:crypto';
import { BrowserRequestHeaders, BrowserResponseHeaders, CONTRACT_VERSION, OperationCatalog, errorStatus } from '@shop/contract';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { RouteRegistry } from '../../bootstrap/RouteRegistry';
import { Deadline } from '../performance/Deadline';
import { ApplicationError } from '../domain/ApplicationError';
import type { OperationMetrics } from '../telemetry/OperationMetrics';
import type { CsrfProtector } from '../security/CsrfProtector';
import { ErrorMapper } from './ErrorMapper';
import { operationController } from './OperationController';
import { isHttpStream } from './HttpStream';

export class HttpApp {
  private readonly origins: ReadonlySet<string>;
  constructor(
    private readonly routes: RouteRegistry,
    origins: readonly string[],
    private readonly csrf: CsrfProtector,
    private readonly errors = new ErrorMapper(),
    private readonly deadlineMilliseconds: number = RUNTIME_LIMITS.http.totalDeadlineMilliseconds,
    private readonly metrics?: OperationMetrics
  ) {
    if (!Number.isSafeInteger(deadlineMilliseconds) || deadlineMilliseconds < 1) throw new Error('HTTP_DEADLINE_INVALID');
    this.origins = new Set(origins);
  }

  async handle(request: Request): Promise<Response> {
    const requestId = request.headers.get('x-request-id') ?? randomUUID();
    const origin = request.headers.get('origin');
    const deadline = Deadline.after(this.deadlineMilliseconds, request.signal);
    const started = performance.now();
    let observedOperation: string | undefined;
    let observedStatus = 500;
    let observedError: string | undefined;
    let observedCancelled = false;
    try {
      if (origin && !this.origins.has(origin)) return secure(403, { code: 'ORIGIN_DENIED', requestId }, requestId);
      if (request.method === 'OPTIONS') return preflight(request, requestId, origin);
      const url = new URL(request.url);
      const route = this.routes.match(request.method, url.pathname);
      if (!route) return secure(404, { code: 'NOT_FOUND', message: 'NOT_FOUND', requestId }, requestId, origin);
      const operation = OperationCatalog.get(operationController(route.operation));
      observedOperation = operation.id;
      assertSafeUrl(url);
      const version = request.headers.get('x-contract-version');
      if (!route.operation.startsWith('runtime.health.') && operation.audience !== 'webhook' && version !== CONTRACT_VERSION) {
        return secure(426, { code: 'CONTRACT_VERSION_UNSUPPORTED', message: 'CONTRACT_VERSION_UNSUPPORTED', requestId, retryable: false }, requestId, origin, { 'x-contract-version': CONTRACT_VERSION });
      }
      assertRequestPolicy(request, origin, operation, this.csrf);
      const payload = await parseBody(request);
      assertBodyTarget(payload.body, request.headers.get('x-client-target'), operation.audience);
      deadline.throwIfExpired();
      const headers = Object.freeze(Object.fromEntries(request.headers.entries()));
      const result = await deadline
        .run((signal) => route.handler({ method: request.method, path: url.pathname, headers, parameters: route.parameters, query: url.searchParams, body: payload.body, rawBody: payload.raw, deadline: deadline.expiresAt, signal }))
        .catch((cause: unknown) => {
          if (cause instanceof Error && cause.message === 'DEADLINE_EXCEEDED') throw new ApplicationError('DEADLINE_EXCEEDED');
          throw cause;
        });
      observedStatus = result.status;
      const response = operationResponse(operation, request, result, this.origins);
      observedStatus = response.status;
      if (isHttpStream(response.body)) {
        const streamContext = { requestId, traceId: request.headers.get('x-trace-id') ?? requestId, operation: operation.id, version: CONTRACT_VERSION };
        const streamStarted = performance.now();
        response.body.onClose((reason) => this.metrics?.stream(streamContext, performance.now() - streamStarted, reason));
        return secureStream(response.status, response.body, request.signal, requestId, origin, response.headers);
      }
      return secure(response.status, response.body, requestId, origin, response.headers, operation.cachePolicy);
    } catch (cause) {
      if (requestCancelled(cause, request.signal)) {
        observedCancelled = true;
        return new Response(null, { status: 499 });
      }
      const traceId = request.headers.get('x-trace-id') ?? requestId;
      this.metrics?.failure(observedOperation ? { requestId, traceId, operation: observedOperation } : { requestId, traceId }, cause);
      const mapped = this.errors.map(cause, requestId, observedOperation as import('@shop/contract').OperationId | undefined);
      observedStatus = mapped.status;
      observedError = bodyCode(mapped.body);
      return secure(mapped.status, mapped.body, requestId, origin, mapped.headers);
    } finally {
      if (observedOperation) {
        const context = { requestId, traceId: request.headers.get('x-trace-id') ?? requestId, operation: observedOperation, version: CONTRACT_VERSION };
        const duration = performance.now() - started;
        if (observedCancelled) this.metrics?.cancelled(context, duration);
        else this.metrics?.observe(context, observedStatus, duration, observedError);
      }
      deadline.dispose();
    }
  }
}

function requestCancelled(cause: unknown, signal: AbortSignal): boolean {
  return signal.aborted && cause instanceof Error && cause.message === 'REQUEST_ABORTED';
}

function assertSafeUrl(url: URL): void {
  for (const [name, value] of url.searchParams) {
    if (
      /^(?:access_?token|id_?token|refresh_?token|mobile|phone|idcard|membership(?:id)?|invitation|invite|claim|preauth|recipient)$/i.test(name) ||
      (name.toLowerCase() === 'code' && !/\/identity\/federations\//.test(url.pathname)) ||
      /^1[3-9]\d{9}$/.test(value) ||
      /^\d{17}[\dXx]$/.test(value) ||
      /^membership:/i.test(value)
    ) {
      throw new ApplicationError('URL_SENSITIVE_DATA_FORBIDDEN');
    }
  }
  if (/\/membership:[^/]+/i.test(url.pathname)) throw new ApplicationError('URL_SENSITIVE_DATA_FORBIDDEN');
}

function bodyCode(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const code = Reflect.get(value, 'code');
  return typeof code === 'string' ? code : undefined;
}

async function parseBody(request: Request): Promise<{ readonly body: unknown; readonly raw: string }> {
  if (request.method === 'GET' || request.method === 'HEAD') return { body: undefined, raw: '' };
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > RUNTIME_LIMITS.http.maximumBodyBytes) throw new ApplicationError('REQUEST_BODY_TOO_LARGE');
  const text = await request.text();
  if (Buffer.byteLength(text) > RUNTIME_LIMITS.http.maximumBodyBytes) throw new ApplicationError('REQUEST_BODY_TOO_LARGE');
  if (text.length === 0) return { body: undefined, raw: '' };
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') throw new ApplicationError('CONTENT_TYPE_UNSUPPORTED');
  try {
    return { body: JSON.parse(text) as unknown, raw: text };
  } catch {
    throw new ApplicationError('REQUEST_JSON_INVALID');
  }
}

function assertBodyTarget(body: unknown, target: string | null, audience: string): void {
  if (audience !== 'public') return;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return;
  const declared = Reflect.get(body, 'target');
  if (declared !== undefined && declared !== target) throw new ApplicationError('AUTHORIZATION_DENIED');
}

function secure(status: number, body: unknown, requestId: string, origin?: string | null, headers: Readonly<Record<string, string>> = {}, cachePolicy: string = 'none'): Response {
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
  if (serialized !== null && Buffer.byteLength(serialized) > RUNTIME_LIMITS.sql.maximumResponseBytes) {
    throw new Error('RESPONSE_BODY_TOO_LARGE');
  }
  return new Response(serialized, { status, headers: output });
}

function secureStream(status: number, stream: import('./HttpStream').HttpStream, signal: AbortSignal, requestId: string, origin?: string | null, headers: Readonly<Record<string, string>> = {}): Response {
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

function preflight(request: Request, requestId: string, origin: string | null): Response {
  if (!origin) return secure(400, { code: 'ORIGIN_REQUIRED', requestId }, requestId);
  const method = request.headers.get('access-control-request-method');
  if (!method || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return secure(405, { code: 'METHOD_NOT_ALLOWED', requestId }, requestId, origin);
  return secure(204, undefined, requestId, origin, {
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': BrowserRequestHeaders.join(','),
    'access-control-max-age': '600',
    'access-control-allow-credentials': 'true',
  });
}

function assertRequestPolicy(request: Request, origin: string | null, operation: ReturnType<typeof OperationCatalog.get>, protector: CsrfProtector): void {
  const target = request.headers.get('x-client-target');
  if ((operation.targetPolicy === 'exact' || operation.targetPolicy === 'public') && !(operation.targets as readonly string[]).includes(target ?? '')) {
    throw new ApplicationError('AUTHORIZATION_DENIED');
  }
  if (operation.targetPolicy === 'service' && target !== null) throw new ApplicationError('AUTHORIZATION_DENIED');
  if (operation.targetPolicy === 'webhook' && target !== null) throw new ApplicationError('AUTHORIZATION_DENIED');
  if (operation.originPolicy === 'sameorigin' && !origin) throw new ApplicationError('ORIGIN_REQUIRED');
  if (operation.csrfPolicy !== 'required') return;
  const cookie = request.headers.get('cookie');
  if (target !== 'console' && target !== 'storefront') throw new ApplicationError('CSRF_TOKEN_INVALID');
  const supplied = request.headers.get('x-csrf-token');
  if (operation.assuranceLevel === 'anonymous' || operation.assuranceLevel === 'preauth') {
    const bootstrap = cookieValue(cookie ?? '', '__Host-auth-csrf');
    if (!bootstrap || !supplied || bootstrap !== supplied) throw new ApplicationError('CSRF_TOKEN_INVALID');
    return;
  }
  const session = cookieValue(cookie ?? '', `__Host-${target}-session`);
  if (!session) throw new ApplicationError('CSRF_TOKEN_INVALID');
  if (!origin) throw new ApplicationError('ORIGIN_REQUIRED');
  const expected = cookieValue(cookie ?? '', `__Host-${target}-csrf`);
  if (!expected || !supplied || expected !== supplied || !protector.verify(supplied, session, target, origin)) throw new ApplicationError('CSRF_TOKEN_INVALID');
}

function operationResponse(operation: ReturnType<typeof OperationCatalog.get>, request: Request, result: Readonly<{ status: number; body?: unknown; headers?: Readonly<Record<string, string>> }>, origins: ReadonlySet<string>) {
  const headers = result.headers ?? {};
  if (result.status < 200 || result.status >= 400) {
    const code = bodyCode(result.body);
    if (!code || !operation.errorUnion.includes(code as never) || errorStatus(code as import('@shop/contract').ApiErrorCode) !== result.status) throw new ApplicationError('INTERNAL_ERROR');
    throw new ApplicationError(code as import('@shop/contract').ApiErrorCode, errorDetails(result.body));
  }
  if (operation.responseMode === 'redirect') {
    const location = headers.location;
    if (result.status !== 303 || !location) throw new ApplicationError('FEDERATION_CALLBACK_REJECTED');
    const target = new URL(location);
    if (!origins.has(target.origin)) throw new ApplicationError('FEDERATION_CALLBACK_REJECTED');
    return { status: 303, body: undefined, headers } as const;
  }
  if (operation.responseMode === 'empty') {
    if (result.status !== 204 || result.body !== undefined) throw new ApplicationError('INTERNAL_ERROR');
    return { status: 204, body: undefined, headers } as const;
  }
  if (operation.responseMode === 'stream') {
    if (result.status !== 200 || !isHttpStream(result.body)) throw new ApplicationError('INTERNAL_ERROR');
    return { status: 200, body: result.body, headers } as const;
  }
  if (operation.cachePolicy === 'etag' && headers.etag && request.headers.get('if-none-match') === headers.etag) {
    return { status: 304, body: undefined, headers } as const;
  }
  return { status: result.status, body: result.body, headers } as const;
}

function errorDetails(body: unknown): Readonly<Record<string, import('../domain/ApplicationError').ErrorDetail>> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return {};
  const record = body as Readonly<Record<string, unknown>>;
  const nested = record.details;
  if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) return nested as Readonly<Record<string, import('../domain/ApplicationError').ErrorDetail>>;
  const entries = Object.entries(record).filter(([key, value]) => key !== 'code' && isErrorDetail(value));
  return Object.freeze(Object.fromEntries(entries) as Record<string, import('../domain/ApplicationError').ErrorDetail>);
}
function isErrorDetail(value: unknown): value is import('../domain/ApplicationError').ErrorDetail {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isErrorDetail);
  return typeof value === 'object' && Object.values(value as Record<string, unknown>).every(isErrorDetail);
}

function cookieValue(cookie: string, name: string): string | null {
  for (const item of cookie.split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}
