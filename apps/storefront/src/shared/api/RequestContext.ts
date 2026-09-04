import { createRequestContext, type RequestContext } from '@shop/sdk';
import type { StorefrontHandle } from '@shop/contract';
import type { StorefrontSession } from '../../entity/session';

export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly write?: boolean;
  readonly idempotencyKey?: string;
  readonly expectedVersion?: number;
  readonly csrfToken?: string;
  readonly cartToken?: string;
  readonly includeScope?: boolean;
  readonly lastEventId?: string;
}

export type RequestContextFactory = (session: StorefrontSession | null, options?: RequestOptions) => RequestContext;

export function createStorefrontContext(clientVersion: string, handle: StorefrontHandle): RequestContextFactory {
  const deviceId = storefrontDevice();
  return (session, options = {}) => {
    if (options.write && !options.idempotencyKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    const csrfToken = options.csrfToken ?? session?.csrfToken ?? null;
    if (options.write && !csrfToken) throw new Error('CSRF_TOKEN_MISSING');
    return createRequestContext(clientVersion, {
      target: 'storefront',
      deviceId,
      storefrontHandle: handle,
      ...(session && options.includeScope !== false ? { scope: session.scope, accessVersion: session.accessVersion } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.write ? { csrfToken: csrfToken! } : {}),
      ...(options.cartToken ? { cartToken: options.cartToken } : {}),
      ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
      ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
      ...(options.lastEventId === undefined ? {} : { lastEventId: options.lastEventId }),
    });
  };
}

const DEVICE_KEY = 'zhudatuan:storefront:device:v1';
function storefrontDevice(): string {
  const existing = globalThis.localStorage?.getItem(DEVICE_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const created = globalThis.crypto.randomUUID();
  globalThis.localStorage?.setItem(DEVICE_KEY, created);
  return created;
}
