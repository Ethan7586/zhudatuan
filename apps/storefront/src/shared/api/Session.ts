import { createRequestContext, type RequestContext, type RequestScope } from '@shop/sdk';
import type { StorefrontHandle } from '@shop/contract';

export interface StorefrontSession {
  readonly membership: string;
  readonly scope: RequestScope;
  readonly accessVersion: number;
  readonly csrfToken: string | null;
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly write?: boolean;
  readonly idempotencyKey?: string;
  readonly expectedVersion?: number;
  readonly includeScope?: boolean;
}

export function requestContext(clientVersion: string, handle: StorefrontHandle, session: StorefrontSession | null, options: RequestOptions = {}): RequestContext {
  if (options.write && !session) throw new Error('AUTHENTICATION_REQUIRED');
  if (options.write && !options.idempotencyKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  if (options.write && !session?.csrfToken) throw new Error('CSRF_TOKEN_MISSING');
  return createRequestContext(clientVersion, {
    target: 'storefront',
    storefrontHandle: handle,
    ...(session && options.includeScope !== false ? { scope: session.scope, accessVersion: session.accessVersion } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.write ? { csrfToken: session!.csrfToken! } : {}),
    ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
  });
}
