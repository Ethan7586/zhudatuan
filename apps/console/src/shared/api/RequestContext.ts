import { createIdempotencyKey, createRequestContext, type RequestContext, type RequestContextOptions, type RequestScope } from '@shop/sdk/context';
import { NAVIGATION_CATALOG_HASH } from '../../generated/NavigationBinding';
import { appConfig } from '../config/AppConfig';

type CacheContext = Readonly<Pick<RequestContextOptions, 'cachedResponse' | 'ifNoneMatch'>>;
type CommandContext = Readonly<Omit<Pick<RequestContextOptions, 'accessVersion' | 'csrfToken' | 'expectedVersion' | 'idempotencyKey' | 'proof' | 'signal'>, 'idempotencyKey'> & { readonly idempotencyKey?: string | null }>;

export function consoleRequest(scope: RequestScope | undefined, signal?: AbortSignal, accessVersion?: number, cache: CacheContext | undefined = undefined): RequestContext {
  return consoleContext({
    ...(scope === undefined ? {} : { scope }),
    ...(signal === undefined ? {} : { signal }),
    ...(accessVersion === undefined ? {} : { accessVersion }),
    ...(cache === undefined ? {} : cache),
  });
}

export function consoleStream(scope: RequestScope, accessVersion: number, signal?: AbortSignal, lastEventId?: string): RequestContext {
  return consoleContext({
    scope,
    accessVersion,
    ...(signal === undefined ? {} : { signal }),
    ...(lastEventId === undefined ? {} : { lastEventId }),
  });
}

export function consoleCommand(scope: RequestScope | undefined, options: CommandContext = {}): RequestContext {
  return consoleContext({
    ...(scope === undefined ? {} : { scope }),
    ...(options.idempotencyKey === null ? {} : { idempotencyKey: options.idempotencyKey ?? createIdempotencyKey() }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.accessVersion === undefined ? {} : { accessVersion: options.accessVersion }),
    ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
    ...(options.proof === undefined ? {} : { proof: options.proof }),
    ...(options.csrfToken === undefined ? {} : { csrfToken: options.csrfToken }),
  });
}

function consoleContext(options: RequestContextOptions): RequestContext {
  return createRequestContext(appConfig.clientVersion, { ...options, target: 'console', catalogVersion: NAVIGATION_CATALOG_HASH });
}
