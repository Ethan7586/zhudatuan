import { CONTRACT_VERSION } from '@shop/contract/version';
import type { RequestContext, RequestScope } from './RequestContext';

export type { RequestContext, RequestScope } from './RequestContext';

export interface RequestContextOptions {
  readonly scope?: RequestScope;
  readonly accessVersion?: number;
  readonly traceId?: string;
  readonly signal?: AbortSignal;
  readonly idempotencyKey?: string;
  readonly expectedVersion?: number;
  readonly proof?: string;
  readonly csrfToken?: string;
}

export function createRequestContext(clientVersion: string, options: RequestContextOptions = {}): RequestContext {
  required(clientVersion, 'SDK_CLIENT_VERSION_REQUIRED');
  optionalVersion(options.accessVersion, 'SDK_ACCESS_VERSION_INVALID');
  optionalVersion(options.expectedVersion, 'SDK_EXPECTED_VERSION_INVALID');
  const traceId = options.traceId ?? randomId();
  required(traceId, 'SDK_TRACE_ID_REQUIRED');
  if (options.scope !== undefined) {
    required(options.scope.id, 'SDK_SCOPE_ID_REQUIRED');
    required(options.scope.kind, 'SDK_SCOPE_KIND_REQUIRED');
  }
  const csrfToken = options.csrfToken ?? browserCookie('shop_csrf');
  return Object.freeze({
    clientVersion,
    contractVersion: CONTRACT_VERSION,
    traceId,
    ...(options.scope === undefined ? {} : { scope: Object.freeze({ ...options.scope }) }),
    ...(options.accessVersion === undefined ? {} : { accessVersion: options.accessVersion }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.idempotencyKey === undefined ? {} : { idempotencyKey: required(options.idempotencyKey, 'SDK_IDEMPOTENCY_KEY_INVALID') }),
    ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
    ...(options.proof === undefined ? {} : { proof: required(options.proof, 'SDK_ACTION_PROOF_INVALID') }),
    ...(csrfToken === undefined ? {} : { csrfToken: required(csrfToken, 'SDK_CSRF_TOKEN_INVALID') }),
  });
}

export function createIdempotencyKey(): string {
  return randomId();
}

function browserCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
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
