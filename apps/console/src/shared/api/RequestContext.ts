import type { ScopeKind } from '@shop/authz';
import { createIdempotencyKey, createRequestContext } from '@shop/sdk/context';
import { NAVIGATION_CATALOG_HASH } from '../../generated/NavigationBinding';
import { appConfig } from '../config/AppConfig';

export interface ConsoleRequestScope {
  readonly kind: ScopeKind;
  readonly id: string;
}

export function consoleRequest(scope: ConsoleRequestScope | undefined, signal?: AbortSignal, accessVersion?: number, cache: Readonly<{ ifNoneMatch: string; cachedResponse: unknown }> | undefined = undefined) {
  return createRequestContext(appConfig.clientVersion, {
    target: 'console',
    catalogVersion: NAVIGATION_CATALOG_HASH,
    ...(scope === undefined ? {} : { scope }),
    ...(signal === undefined ? {} : { signal }),
    ...(accessVersion === undefined ? {} : { accessVersion }),
    ...(cache === undefined ? {} : cache),
  });
}

export function consoleStream(scope: ConsoleRequestScope, accessVersion: number, signal?: AbortSignal, lastEventId?: string) {
  return createRequestContext(appConfig.clientVersion, {
    target: 'console',
    catalogVersion: NAVIGATION_CATALOG_HASH,
    scope,
    accessVersion,
    ...(signal === undefined ? {} : { signal }),
    ...(lastEventId === undefined ? {} : { lastEventId }),
  });
}

export function consoleCommand(
  scope: ConsoleRequestScope | undefined,
  options: Readonly<{
    signal?: AbortSignal;
    accessVersion?: number;
    expectedVersion?: number;
    proof?: string;
    csrfToken?: string;
    idempotencyKey?: string;
  }> = {}
) {
  return createRequestContext(appConfig.clientVersion, {
    target: 'console',
    catalogVersion: NAVIGATION_CATALOG_HASH,
    ...(scope === undefined ? {} : { scope }),
    idempotencyKey: options.idempotencyKey ?? createIdempotencyKey(),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.accessVersion === undefined ? {} : { accessVersion: options.accessVersion }),
    ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
    ...(options.proof === undefined ? {} : { proof: options.proof }),
    ...(options.csrfToken === undefined ? {} : { csrfToken: options.csrfToken }),
  });
}
