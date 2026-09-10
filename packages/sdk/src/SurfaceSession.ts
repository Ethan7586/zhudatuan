import type { OperationOutputFor, OperationTarget } from '@shop/contract';
import { BROWSER_QUERY_POLICY } from '@shop/config/runtime';
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

interface TimedValue<T> {
  readonly checkedAt: number;
  readonly value: T;
}

export class SurfaceAccessRuntime {
  private sessionValue: TimedValue<SurfaceSession> | undefined;
  private readonly navigationValues = new Map<string, TimedValue<SurfaceNavigation>>();

  constructor(
    private readonly client: SurfaceAccessClient,
    private readonly environment: SurfaceAccessEnvironment,
    private readonly surface: OperatorSurface,
    private readonly catalogVersion: string,
    private readonly now: () => number = Date.now
  ) {}

  async session(signal: AbortSignal): Promise<SurfaceSession> {
    available(signal);
    if (this.sessionValue !== undefined && this.fresh(this.sessionValue)) return this.sessionValue.value;
    const value = await readSurfaceSession(this.client, this.environment, this.surface, this.catalogVersion, signal);
    available(signal);
    if (this.sessionValue === undefined || sessionIdentity(this.sessionValue.value) !== sessionIdentity(value)) this.navigationValues.clear();
    this.sessionValue = Object.freeze({ value, checkedAt: this.now() });
    return value;
  }

  async navigation(session: SurfaceSession, scope: RequestScope, signal: AbortSignal): Promise<SurfaceNavigation> {
    available(signal);
    const key = navigationIdentity(session, scope, this.catalogVersion);
    const prior = this.navigationValues.get(key);
    if (prior !== undefined && this.fresh(prior)) return prior.value;
    const value = await readSurfaceNavigation(this.client, this.environment, session, scope, this.catalogVersion, signal);
    available(signal);
    this.navigationValues.set(key, Object.freeze({ value, checkedAt: this.now() }));
    return value;
  }

  clear(): void {
    this.sessionValue = undefined;
    this.navigationValues.clear();
  }

  private fresh(value: TimedValue<unknown>): boolean {
    return this.now() - value.checkedAt < BROWSER_QUERY_POLICY.query.staleMilliseconds;
  }
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
    ...(session.csrf === undefined ? {} : { csrfToken: session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  });
}

export function surfaceNavigationNodes(navigation: SurfaceNavigation): readonly SurfaceNavigation['nodes'][number][] {
  return flattenNavigation(navigation.nodes);
}

export function preloadSurfaceRoutes(navigation: SurfaceNavigation, routes: Readonly<Record<string, Readonly<{ load(): Promise<unknown> }>>>): void {
  for (const node of surfaceNavigationNodes(navigation)) {
    if (node.experience.disabled) continue;
    const route = routes[node.experience.routeKey];
    if (route !== undefined) void route.load().catch(() => undefined);
  }
}

function sessionIdentity(session: SurfaceSession): string {
  return [session.actor, session.session, session.membership, session.target, session.accessVersion].join('|');
}

function navigationIdentity(session: SurfaceSession, scope: RequestScope, catalogVersion: string): string {
  return [sessionIdentity(session), scope.kind, scope.id, catalogVersion].join('|');
}

function flattenNavigation(nodes: readonly SurfaceNavigation['nodes'][number][]): readonly SurfaceNavigation['nodes'][number][] {
  return Object.freeze(nodes.flatMap((node) => [node, ...flattenNavigation(node.children)]));
}

function available(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new Error('SURFACE_ACCESS_ABORTED');
}
