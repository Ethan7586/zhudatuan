import type { ScopeKind } from '@shop/authz';
import type { StorefrontHandle } from '@shop/contract';

export interface RequestScope {
  readonly kind: ScopeKind;
  readonly id: string;
}

export interface RequestContext {
  readonly clientVersion: string;
  readonly contractVersion: string;
  readonly traceId: string;
  readonly scope?: RequestScope;
  readonly storefrontHandle?: StorefrontHandle;
  readonly accessVersion?: number;
  readonly signal?: AbortSignal;
  readonly idempotencyKey?: string;
  readonly expectedVersion?: number;
  readonly proof?: string;
  readonly csrfToken?: string;
  readonly deviceId?: string;
  readonly target?: 'console' | 'storefront';
  readonly catalogVersion?: string;
  readonly ifNoneMatch?: string;
  readonly cachedResponse?: unknown;
}
