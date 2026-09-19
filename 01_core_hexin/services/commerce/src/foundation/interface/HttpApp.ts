import { randomUUID } from 'node:crypto';
import { OperationCatalog, type OperationGateDeclaration } from '@shop/contract';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { NodeContextResolver, ResolvedNodeContext } from '@shop/config/sfl-node-kernel';
import type { RouteRegistry } from '../../bootstrap/RouteRegistry';
import { Deadline } from '../performance/Deadline';
import { bindRequestNodeContext, requestNodeContext } from '../security/AccessContext';
import { AUTH_TARGET_CONTEXT_HEADER, authTargetForSurface, requestCsrfCookie, requestSessionCookie } from '../security/AuthSessionCookies';
import type { GateEngine } from '../security/gate_menjin';
import type { OperationMetrics } from '../telemetry/OperationMetrics';
import type { ArchBoard } from '@shop/l-kernel/arch';
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
    private readonly gateEngine?: GateEngine, private readonly nodeContexts?: NodeContextResolver,
    private readonly arch?: ArchBoard) {
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
      observedPhase = 'request';
      const nodeContext = route.operation.startsWith('runtime.health.')
        ? undefined
        : requestNodeContext(request.headers) ?? this.nodeContexts?.resolve(request.headers.get('host') ?? url.host);
      observedNodeContext = nodeContext;
      const archNodeId = nodeContext?.node_id ?? 'unresolved';
      if (this.arch !== undefined && !operation.id.startsWith('runtime.health.')
        && this.arch.state(archNodeId, operation.id) !== 'connected') {
        observedPhase = 'arch';
        observedStatus = 404;
        observedError = 'NOT_FOUND';
        return secure(404, { code: 'NOT_FOUND', message: 'NOT_FOUND', requestId }, requestId, origin);
      }
      const simpleSession = isSimpleIdentitySession(request, operation.id);
      if (simpleSession && !origin) throw new Error('ORIGIN_REQUIRED');
      const parsed = await parseBody(request, simpleSession);
      const payload = simpleSession ? unpackSimpleIdentitySession(parsed) : parsed;
      deadline.throwIfExpired();
      const callerTarget = resolveCallerAuthTarget(origin, this.nodeContexts);
      const requestHeaders = Object.freeze({
        ...Object.fromEntries(request.headers.entries()),
        ...payload.headers,
        [AUTH_TARGET_CONTEXT_HEADER]: callerTarget ?? '',
      });
      observedPhase = 'csrf';
      assertCsrf(request.method, requestHeaders, origin, operation.id, simpleSession);
      const headers = nodeContext === undefined ? requestHeaders : bindRequestNodeContext(requestHeaders, nodeContext);
      observedPhase = 'gate';
      await observeOperationGates(this.gateEngine, operation.id, operation.gates, requestId, traceId);
      observedPhase = 'handler';
      const exchanged = await deadline.run((signal) => {
        const input = { method: request.method, path: url.pathname, headers, parameters: route.parameters,
          query: url.searchParams, body: payload.body, rawBody: payload.raw, deadline: deadline.expiresAt, signal };
        return this.arch === undefined || operation.id.startsWith('runtime.health.')
          ? route.handler(input).then((output) => ({ connected: true as const, output }))
          : this.arch.exchange(archNodeId, operation.id, input, route.handler);
      });
      if (!exchanged.connected) {
        observedStatus = 404;
        observedError = 'NOT_FOUND';
        return secure(404, { code: 'NOT_FOUND', message: 'NOT_FOUND', requestId }, requestId, origin);
      }
      const result = exchanged.output;
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
        operation: observedOperation, version: request.headers.get('x-contract-version') ?? 'unversioned', phase: observedPhase,
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

type ParsedBody = Readonly<{ body: unknown; raw: string; headers?: Readonly<Record<string, string>> }>;

async function parseBody(request: Request, allowText = false): Promise<ParsedBody> {
  if (request.method === 'GET' || request.method === 'HEAD') return { body: undefined, raw: '' };
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) throw new Error('REQUEST_BODY_TOO_LARGE');
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('REQUEST_BODY_TOO_LARGE');
  if (text.length === 0) return { body: undefined, raw: '' };
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json' && !(allowText && mediaType === 'text/plain')) throw new Error('CONTENT_TYPE_UNSUPPORTED');
  try {
    return { body: JSON.parse(text) as unknown, raw: text };
  } catch {
    throw new Error('REQUEST_JSON_INVALID');
  }
}

function isSimpleIdentitySession(request: Request, operation: string): boolean {
  return operation === 'identity.sessions.create'
    && request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() === 'text/plain';
}

function unpackSimpleIdentitySession(payload: ParsedBody): ParsedBody {
  if (payload.body === null || typeof payload.body !== 'object' || Array.isArray(payload.body)) throw new Error('REQUEST_JSON_INVALID');
  const body = payload.body as Record<string, unknown>;
  const transport = body._transport;
  if (transport === null || typeof transport !== 'object' || Array.isArray(transport)) throw new Error('REQUEST_JSON_INVALID');
  const metadata = transport as Record<string, unknown>;
  const idempotencyKey = transportField(metadata.idempotencyKey, 255);
  const clientVersion = transportField(metadata.clientVersion, 64);
  const device = transportField(metadata.deviceId, 128);
  const { _transport: _ignored, ...operationBody } = body;
  return {
    body: operationBody,
    raw: JSON.stringify(operationBody),
    headers: { 'idempotency-key': idempotencyKey, 'x-client-version': clientVersion, 'x-device-id': device },
  };
}

function transportField(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum) throw new Error('REQUEST_JSON_INVALID');
  return value;
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
  const responseBody = status >= 400 ? errorContractBody(body, requestId) : body;
  return new Response(responseBody === undefined ? null : JSON.stringify(responseBody), { status, headers: output });
}

function errorContractBody(body: unknown, requestId: string): Readonly<Record<string, unknown>> {
  const record = body !== null && typeof body === 'object' && !Array.isArray(body)
    ? body as Readonly<Record<string, unknown>> : {};
  const code = typeof record.code === 'string' && record.code.length > 0 ? record.code : 'INTERNAL_ERROR';
  const message = typeof record.message === 'string' && record.message.length > 0 ? record.message : code;
  const responseRequestId = typeof record.requestId === 'string' && record.requestId.length > 0 ? record.requestId : requestId;
  const details = record.details !== null && typeof record.details === 'object' && !Array.isArray(record.details)
    ? record.details as Readonly<Record<string, unknown>> : undefined;
  return {
    code,
    message,
    requestId: responseRequestId,
    ...(typeof record.retryable === 'boolean' ? { retryable: record.retryable } : {}),
    ...(details === undefined ? {} : { details }),
  };
}

function preflight(request: Request, requestId: string, origin: string | null): Response {
  if (!origin) return secure(400, { code: 'ORIGIN_REQUIRED', requestId }, requestId);
  const method = request.headers.get('access-control-request-method');
  if (!method || !['GET','POST','PUT','PATCH','DELETE'].includes(method)) return secure(405, { code: 'METHOD_NOT_ALLOWED', requestId }, requestId, origin);
  return secure(204, undefined, requestId, origin, { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,idempotency-key,if-match,x-access-version,x-contract-version,x-csrf-token,x-request-id,x-trace-id,x-client-version,x-device-id,x-scope-hint',
    'access-control-max-age': '7200', 'access-control-allow-credentials': 'true' });
}

function assertCsrf(method: string, headers: Readonly<Record<string, string>>, origin: string | null, operation: string, simpleSession: boolean): void {
  if (['GET','HEAD','OPTIONS'].includes(method)) return;
  if (operation === 'identity.tickets.exchange') return;
  if (simpleSession) return;
  if (requestSessionCookie(headers) === undefined) return;
  if (!origin) throw new Error('ORIGIN_REQUIRED');
  const expected = requestCsrfCookie(headers);
  if (!expected || headers['x-csrf-token'] !== expected) throw new Error('CSRF_TOKEN_INVALID');
}

function resolveCallerAuthTarget(origin: string | null, resolver: NodeContextResolver | undefined) {
  if (origin === null || resolver === undefined) return undefined;
  try {
    return authTargetForSurface(resolver.resolve(new URL(origin).host).surface);
  } catch {
    return undefined;
  }
}
