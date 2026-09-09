import { randomUUID } from 'node:crypto';
import { CONTRACT_VERSION, OperationCatalog, type OperationGateDeclaration } from '@shop/contract';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { NodeContextResolver, ResolvedNodeContext } from '@shop/config/sfl-node-kernel';
import type { RouteRegistry } from '../../bootstrap/RouteRegistry';
import { Deadline } from '../performance/Deadline';
import { bindRequestNodeContext, requestNodeContext } from '../security/AccessContext';
import type { GateEngine } from '../security/gate_menjin';
import type { OperationMetrics } from '../telemetry/OperationMetrics';
import { ErrorMapper } from './ErrorMapper';

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const STALE_IDENTITY_COOKIE_RECOVERY = new Set([
  'identity.sessions.create',
  'identity.challenges.create',
  'identity.members.create',
]);
const EXPIRED_IDENTITY_COOKIES = Object.freeze({
  'set-cookie': 'shop_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  'x-set-cookie': 'shop_csrf=; Path=/; Max-Age=0; Secure; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
});

export class HttpApp {
  private readonly origins: ReadonlySet<string>;
  constructor(private readonly routes: RouteRegistry, origins: readonly string[], private readonly errors = new ErrorMapper(),
    private readonly deadlineMilliseconds: number = RUNTIME_LIMITS.http.totalDeadlineMilliseconds, private readonly metrics?: OperationMetrics,
    private readonly gateEngine?: GateEngine, private readonly nodeContexts?: NodeContextResolver) {
    if (!Number.isSafeInteger(deadlineMilliseconds) || deadlineMilliseconds < 1) throw new Error('HTTP_DEADLINE_INVALID');
    this.origins = new Set(origins);
  }

  async handle(request: Request): Promise<Response> {
    const requestId = request.headers.get('x-request-id') ?? randomUUID();
    const traceId = request.headers.get('x-trace-id') ?? requestId;
    const origin = request.headers.get('origin');
    const deadline = Deadline.after(this.deadlineMilliseconds, request.signal);
    const started = performance.now();
    let observedOperation: string | undefined;
    let observedStatus = 500;
    let observedError: string | undefined;
    let observedPhase = 'routing';
    let observedNodeContext: ResolvedNodeContext | undefined;
    try {
      if (origin && !this.origins.has(origin)) return secure(403, { code: 'ORIGIN_DENIED', requestId }, requestId);
      if (request.method === 'OPTIONS') return preflight(request, requestId, origin);
      const url = new URL(request.url);
      const route = this.routes.match(request.method, url.pathname);
      if (!route) return secure(404, { code: 'NOT_FOUND', message: 'NOT_FOUND', requestId }, requestId, origin);
      const operation = OperationCatalog.get(route.operation);
      observedOperation = operation.id;
      observedPhase = 'csrf';
      assertCsrf(request, origin, operation.id);
      observedPhase = 'contract';
      const version = request.headers.get('x-contract-version');
      if (!route.operation.startsWith('runtime.health.') && operation.audience !== 'provider' && version !== CONTRACT_VERSION) {
        observedStatus = 426;
        observedError = 'CONTRACT_VERSION_UNSUPPORTED';
        return secure(426, { code: 'CONTRACT_VERSION_UNSUPPORTED', message: '客户端版本不兼容，请刷新页面后重试', requestId,
          required: CONTRACT_VERSION }, requestId, origin, { 'x-contract-version': CONTRACT_VERSION });
      }
      observedPhase = 'request';
      const nodeContext = route.operation.startsWith('runtime.health.')
        ? undefined
        : requestNodeContext(request.headers) ?? this.nodeContexts?.resolve(request.headers.get('host') ?? url.host);
      observedNodeContext = nodeContext;
      const payload = await parseBody(request);
      deadline.throwIfExpired();
      const requestHeaders = Object.freeze(Object.fromEntries(request.headers.entries()));
      const headers = nodeContext === undefined ? requestHeaders : bindRequestNodeContext(requestHeaders, nodeContext);
      observedPhase = 'gate';
      await observeOperationGates(this.gateEngine, operation.id, operation.gates, requestId, traceId);
      observedPhase = 'handler';
      const result = await deadline.run((signal) => route.handler({ method: request.method, path: url.pathname, headers, parameters: route.parameters,
        query: url.searchParams, body: payload.body, rawBody: payload.raw, deadline: deadline.expiresAt, signal }));
      observedStatus = result.status;
      observedError = result.status >= 400 ? bodyCode(result.body) : undefined;
      if (result.status < 400) observedPhase = 'complete';
      return secure(result.status, result.body, requestId, origin, result.headers);
    } catch (cause) {
      const mapped = this.errors.map(cause, requestId);
      observedStatus = mapped.status;
      observedError = internalErrorCode(cause) ?? bodyCode(mapped.body);
      const recoverStaleIdentityCookie = observedError === 'CSRF_TOKEN_INVALID'
        && observedOperation !== undefined && STALE_IDENTITY_COOKIE_RECOVERY.has(observedOperation);
      return secure(mapped.status, mapped.body, requestId, origin,
        recoverStaleIdentityCookie ? { ...mapped.headers, ...EXPIRED_IDENTITY_COOKIES } : mapped.headers);
    } finally {
      if (observedOperation) this.metrics?.observe({ requestId, traceId,
        operation: observedOperation, version: CONTRACT_VERSION, phase: observedPhase,
        ...identityRealmObservation(observedOperation, observedNodeContext) }, observedStatus, performance.now()-started, observedError);
      deadline.dispose();
    }
  }
}

function identityRealmObservation(
  operation: string,
  nodeContext: ResolvedNodeContext | undefined,
): Readonly<{ nodeId?: string; realmId?: string }> {
  if (!operation.startsWith('identity.')) return {};
  return nodeContext === undefined
    ? { nodeId: 'unresolved', realmId: 'unresolved' }
    : { nodeId: nodeContext.node_id, realmId: nodeContext.manifest.realm_ref.ref };
}

function internalErrorCode(cause: unknown): string | undefined {
  if (!(cause instanceof Error)) return undefined;
  const code = cause.message.split(':', 1)[0]?.trim();
  return code === '' ? undefined : code;
}

async function observeOperationGates(
  engine: GateEngine | undefined,
  operationId: string,
  gates: readonly OperationGateDeclaration[] | undefined,
  requestId: string,
  traceId: string,
): Promise<void> {
  if (engine === undefined || gates === undefined) return;
  const slots = gates.filter((gate) => gate.mode === 'observe').map((gate) => gate.slot);
  if (slots.length === 0) return;
  try {
    await engine.execute({
      operation_id: operationId,
      gate_slots: Object.freeze(slots),
      execution_phase: 'before',
      mode: 'observe',
      failure_behavior: 'continue',
    }, {
      operation_id: operationId,
      execution_phase: 'before',
      trace_id: traceId,
      attributes: Object.freeze({ request_id: requestId }),
    });
  } catch {
    // Observe mode cannot alter the original HTTP operation.
  }
}

function bodyCode(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const code = Reflect.get(value, 'code');
  return typeof code === 'string' ? code : undefined;
}

async function parseBody(request: Request): Promise<{ readonly body: unknown; readonly raw: string }> {
  if (request.method === 'GET' || request.method === 'HEAD') return { body: undefined, raw: '' };
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) throw new Error('REQUEST_BODY_TOO_LARGE');
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('REQUEST_BODY_TOO_LARGE');
  if (text.length === 0) return { body: undefined, raw: '' };
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') throw new Error('CONTENT_TYPE_UNSUPPORTED');
  try {
    return { body: JSON.parse(text) as unknown, raw: text };
  } catch {
    throw new Error('REQUEST_JSON_INVALID');
  }
}

function secure(status: number, body: unknown, requestId: string, origin?: string | null, headers: Readonly<Record<string, string>> = {}): Response {
  const output = new Headers({ 'content-type': 'application/json; charset=utf-8', 'x-request-id': requestId, 'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'strict-transport-security': 'max-age=63072000; includeSubDomains', ...(origin ? {
      'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', vary: 'origin',
    } : {}) });
  for (const [name, value] of Object.entries(headers)) {
    if (name === 'x-set-cookie') output.append('set-cookie', value);
    else output.set(name, value);
  }
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: output });
}

function preflight(request: Request, requestId: string, origin: string | null): Response {
  if (!origin) return secure(400, { code: 'ORIGIN_REQUIRED', requestId }, requestId);
  const method = request.headers.get('access-control-request-method');
  if (!method || !['GET','POST','PUT','PATCH','DELETE'].includes(method)) return secure(405, { code: 'METHOD_NOT_ALLOWED', requestId }, requestId, origin);
  return secure(204, undefined, requestId, origin, { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,idempotency-key,if-match,x-access-version,x-contract-version,x-csrf-token,x-request-id,x-trace-id,x-client-version,x-device-id,x-scope-hint',
    'access-control-max-age': '600', 'access-control-allow-credentials': 'true' });
}

function assertCsrf(request: Request, origin: string | null, operation: string): void {
  if (['GET','HEAD','OPTIONS'].includes(request.method)) return;
  if (operation === 'identity.tickets.exchange') return;
  const cookie = request.headers.get('cookie');
  if (!cookie?.split(';').some((part) => part.trim().startsWith('shop_session='))) return;
  if (!origin) throw new Error('ORIGIN_REQUIRED');
  const expected = cookieValue(cookie, 'shop_csrf');
  if (!expected || request.headers.get('x-csrf-token') !== expected) throw new Error('CSRF_TOKEN_INVALID');
}

function cookieValue(cookie: string, name: string): string | null {
  for (const item of cookie.split(';')) { const [key, ...rest] = item.trim().split('='); if (key === name) return decodeURIComponent(rest.join('=')); }
  return null;
}
