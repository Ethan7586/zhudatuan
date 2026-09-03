import { createRequestContext, type RequestContext } from '@shop/sdk';
import type { StorefrontHandle } from '@shop/contract';
import type { StorefrontSession } from '../../entity/session';

export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly write?: boolean;
  readonly idempotencyKey?: string;
  readonly expectedVersion?: number;
  readonly includeScope?: boolean;
  readonly lastEventId?: string;
}

export type RequestContextFactory = (session: StorefrontSession | null, options?: RequestOptions) => RequestContext;

export function createStorefrontContext(clientVersion: string, handle: StorefrontHandle): RequestContextFactory {
  return (session, options = {}) => {
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
      ...(options.lastEventId === undefined ? {} : { lastEventId: options.lastEventId }),
    });
  };
}
