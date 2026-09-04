import { CONTRACT_VERSION } from '@shop/contract/version';
import { isOperationTarget, parseStorefrontHandle, type OperationTarget } from '@shop/contract';
import type { RequestContext, RequestScope } from './RequestContext';

export type { RequestContext, RequestScope } from './RequestContext';

export interface RequestContextOptions {
  readonly scope?: RequestScope;
  readonly storefrontHandle?: string;
  readonly accessVersion?: number;
  readonly traceId?: string;
  readonly signal?: AbortSignal;
  readonly idempotencyKey?: string;
  readonly expectedVersion?: number;
  readonly proof?: string;
  readonly cartToken?: string;
  readonly csrfToken?: string;
  readonly deviceId?: string;
  readonly target?: OperationTarget;
  readonly catalogVersion?: string;
  readonly ifNoneMatch?: string;
  readonly lastEventId?: string;
  readonly cachedResponse?: unknown;
}

export function createRequestContext(clientVersion: string, options: RequestContextOptions = {}): RequestContext {
  required(clientVersion, 'SDK_CLIENT_VERSION_REQUIRED');
  optionalVersion(options.accessVersion, 'SDK_ACCESS_VERSION_INVALID');
  optionalVersion(options.expectedVersion, 'SDK_EXPECTED_VERSION_INVALID');
  if (options.target !== undefined && !isOperationTarget(options.target)) throw new Error('SDK_CLIENT_TARGET_INVALID');
  const traceId = options.traceId ?? randomId();
  required(traceId, 'SDK_TRACE_ID_REQUIRED');
  if (options.scope !== undefined) {
    required(options.scope.id, 'SDK_SCOPE_ID_REQUIRED');
    required(options.scope.kind, 'SDK_SCOPE_KIND_REQUIRED');
  }
  const csrfToken = options.csrfToken;
  return Object.freeze({
    clientVersion,
    contractVersion: CONTRACT_VERSION,
    traceId,
    ...(options.scope === undefined ? {} : { scope: Object.freeze({ ...options.scope }) }),
    ...(options.storefrontHandle === undefined ? {} : { storefrontHandle: parseStorefrontHandle(options.storefrontHandle) }),
    ...(options.accessVersion === undefined ? {} : { accessVersion: options.accessVersion }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.idempotencyKey === undefined ? {} : { idempotencyKey: required(options.idempotencyKey, 'SDK_IDEMPOTENCY_KEY_INVALID') }),
    ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
    ...(options.proof === undefined ? {} : { proof: required(options.proof, 'SDK_ACTION_PROOF_INVALID') }),
    ...(options.cartToken === undefined ? {} : { cartToken: token(options.cartToken) }),
    ...(csrfToken === undefined ? {} : { csrfToken: required(csrfToken, 'SDK_CSRF_TOKEN_INVALID') }),
    ...(options.deviceId === undefined ? {} : { deviceId: required(options.deviceId, 'SDK_DEVICE_ID_INVALID') }),
    ...(options.target === undefined ? {} : { target: options.target }),
    ...(options.catalogVersion === undefined ? {} : { catalogVersion: required(options.catalogVersion, 'SDK_CATALOG_VERSION_INVALID') }),
    ...(options.ifNoneMatch === undefined ? {} : { ifNoneMatch: required(options.ifNoneMatch, 'SDK_ETAG_INVALID') }),
    ...(options.lastEventId === undefined ? {} : { lastEventId: required(options.lastEventId, 'SDK_EVENT_CURSOR_INVALID') }),
    ...(options.cachedResponse === undefined ? {} : { cachedResponse: options.cachedResponse }),
  });
}

export function createIdempotencyKey(): string {
  return randomId();
}

function randomId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('SDK_SECURE_ID_SOURCE_UNAVAILABLE');
  return globalThis.crypto.randomUUID();
}

function required(value: string, code: string): string {
  if (value.trim().length === 0) throw new Error(code);
  return value;
}

function optionalVersion(value: number | undefined, code: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new Error(code);
}

function token(value: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('SDK_CART_TOKEN_INVALID');
  return value;
}
