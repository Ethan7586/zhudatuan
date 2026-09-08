import type { OperationOutputFor, OperationTarget } from '@shop/contract';
import type { OperationMethod } from './OperationDescriptor';
import { createRequestContext } from './RequestContextFactory';
import type { RequestContext, RequestScope } from './RequestContext';

export type OperatorSurface = 'store' | 'supplier';
export type SurfaceSession = OperationOutputFor<'identity.session.read'>;
export type SurfaceNavigation = OperationOutputFor<'navigation.tree.read'>;

export interface SurfaceAccessClient {
  readonly identity: Readonly<{ sessionRead: OperationMethod<'identity.session.read'> }>;
  readonly navigation: Readonly<{ treeRead: OperationMethod<'navigation.tree.read'> }>;
}

export interface SurfaceAccessEnvironment {
  readonly target: OperationTarget;
  readonly clientVersion: string;
}

export async function readSurfaceSession(client: SurfaceAccessClient, environment: SurfaceAccessEnvironment, surface: OperatorSurface, catalogVersion: string, signal: AbortSignal): Promise<SurfaceSession> {
  if (environment.target !== surface) throw new Error('SURFACE_ENVIRONMENT_TARGET_INVALID');
  const value = await client.identity.sessionRead({}, createRequestContext(environment.clientVersion, { target: surface, catalogVersion, signal }));
  if (value.target !== surface) throw new Error('SURFACE_SESSION_TARGET_INVALID');
  return value;
}

export function selectSurfaceScope(session: SurfaceSession, surface: OperatorSurface, candidate?: Readonly<{ kind: string; id: string }>): RequestScope {
  const scope = candidate === undefined ? session.scopes.find((value) => value.kind === surface) : session.scopes.find((value) => value.kind === candidate.kind && value.id === candidate.id);
  if (scope === undefined || scope.kind !== surface || scope.id.length === 0) throw new Error('SURFACE_SCOPE_DENIED');
  return Object.freeze({ kind: scope.kind, id: scope.id });
}

export async function readSurfaceNavigation(client: SurfaceAccessClient, environment: SurfaceAccessEnvironment, session: SurfaceSession, scope: RequestScope, catalogVersion: string, signal: AbortSignal): Promise<SurfaceNavigation> {
  const context = surfaceRequestContext(environment, session, scope, catalogVersion, signal);
  const value = await client.navigation.treeRead({ query: { scopeid: scope.id } }, context);
  if (value.target !== environment.target || value.scope.id !== scope.id || value.scope.kind !== scope.kind || value.catalogVersion !== catalogVersion) {
    throw new Error('SURFACE_NAVIGATION_MISMATCH');
  }
  return value;
}

export function surfaceRequestContext(environment: SurfaceAccessEnvironment, session: SurfaceSession, scope: RequestScope, catalogVersion: string, signal?: AbortSignal): RequestContext {
  return createRequestContext(environment.clientVersion, {
    target: environment.target,
    scope,
    accessVersion: session.accessVersion,
    catalogVersion,
    ...(signal === undefined ? {} : { signal }),
  });
}
