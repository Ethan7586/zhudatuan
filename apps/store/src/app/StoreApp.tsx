import { OperatorWorkspace, RouteScroll, useBrowserPath, useResourceQuery } from '@shop/design';
import { hasFailureCode, presentError, projectRecords } from '@shop/presentation';
import { readSurfaceNavigation, readSurfaceSession, selectSurfaceScope, surfaceRequestContext, type SurfaceNavigation } from '@shop/sdk';
import { useCallback, useEffect, useMemo } from 'react';
import { createStoreDependencies, type StoreDependencies } from './Dependencies';
import { STORE_ROUTES } from './RouteRegistry';
import { NAVIGATION_CATALOG_HASH } from '../generated/NavigationBinding';
import { matchRoutePath, resolveRoutePath, type RouteId, type RouteMatch } from '../generated/RouteBinding';

interface StoreSnapshot {
  readonly scopeLabel: string;
  readonly title: string;
  readonly description: string;
  readonly items: readonly Readonly<{ id: string; path: string; title: string }>[];
  readonly data: ReturnType<typeof projectRecords>;
}

export function StoreApp({ dependencies: supplied }: Readonly<{ dependencies?: StoreDependencies }>) {
  const dependencies = useMemo(() => supplied ?? createStoreDependencies(), [supplied]);
  const location = useBrowserPath();
  const load = useCallback((signal: AbortSignal) => loadStore(dependencies, location.pathname, location.navigate, signal), [dependencies, location.pathname, location.navigate]);
  const query = useResourceQuery(location.pathname, load);
  const authenticationRequired = hasFailureCode(query.error, 'AUTHENTICATION_REQUIRED');
  useEffect(() => {
    if (authenticationRequired) window.location.replace(authHref(dependencies.environment.authOrigin, location.pathname));
  }, [authenticationRequired, dependencies.environment.authOrigin, location.pathname]);
  const error = query.error === undefined || authenticationRequired ? undefined : presentError(query.error).message;
  const value = query.data;
  if (value === undefined) {
    return (<>
      <RouteScroll entry={location.entry} />
      <OperatorWorkspace product="门店工作台" scopeLabel="正在校验门店身份" pathname={location.pathname} title="正在加载" description="正在同步权限、导航和业务数据。" items={[]} data={undefined} {...(error === undefined ? {} : { error })} retry={query.reload} navigate={location.navigate} />
    </>);
  }
  return <><RouteScroll entry={location.entry} /><OperatorWorkspace product="门店工作台" pathname={location.pathname} {...value} {...(error === undefined ? {} : { error })} retry={query.reload} navigate={location.navigate} /></>;
}

async function loadStore(dependencies: StoreDependencies, pathname: string, navigate: (path: string, replace?: boolean) => void, signal: AbortSignal): Promise<StoreSnapshot> {
  const session = await readSurfaceSession(dependencies.client, dependencies.environment, 'store', NAVIGATION_CATALOG_HASH, signal);
  const match = pathname === '/' ? undefined : matchRoutePath(pathname);
  if (pathname !== '/' && match === undefined) throw new Error('STORE_ROUTE_NOT_FOUND');
  const scope = selectSurfaceScope(session, 'store', match === undefined ? undefined : scopeCandidate(match));
  const navigation = await readSurfaceNavigation(dependencies.client, dependencies.environment, session, scope, NAVIGATION_CATALOG_HASH, signal);
  const items = navigationItems(navigation, scope.kind, scope.id);
  const landing = navigationLanding(navigation, scope.kind, scope.id);
  if (pathname === '/') {
    navigate(landing, true);
  }
  const route = match ?? matchRoutePath(landing);
  if (route === undefined || !routeAllowed(route, navigation)) throw new Error('STORE_ROUTE_DENIED');
  const binding = STORE_ROUTES[route.id];
  const manifest = await binding.load();
  const context = surfaceRequestContext(dependencies.environment, session, scope, NAVIGATION_CATALOG_HASH, signal);
  const result = await manifest.viewModel.read(dependencies.client, context, route);
  return Object.freeze({ scopeLabel: '当前门店', title: manifest.viewModel.title, description: manifest.viewModel.description, items, data: projectRecords(result) });
}

function navigationItems(navigation: SurfaceNavigation, scopeKind: string, scopeId: string): readonly Readonly<{ id: string; path: string; title: string }>[] {
  return Object.freeze(
    flatten(navigation.nodes)
      .filter((node) => !node.experience.disabled && node.experience.placement === 'primary')
      .map((node) => Object.freeze({ id: node.experience.routeKey, title: node.title, path: resolveRoutePath(node.experience.routeKey as RouteId, { scopeKind, scopeId }) }))
  );
}

function routeAllowed(route: RouteMatch, navigation: SurfaceNavigation): boolean {
  const enabled = flatten(navigation.nodes).filter((node) => !node.experience.disabled);
  return enabled.some((node) => node.experience.routeKey === route.id);
}

function navigationLanding(navigation: SurfaceNavigation, scopeKind: string, scopeId: string): string {
  const node = flatten(navigation.nodes).find((candidate) => candidate.key === navigation.defaultKey && !candidate.experience.disabled);
  if (node === undefined) throw new Error('STORE_NAVIGATION_EMPTY');
  return resolveRoutePath(node.experience.routeKey as RouteId, { scopeKind, scopeId });
}

function flatten(nodes: readonly SurfaceNavigation['nodes'][number][]): readonly SurfaceNavigation['nodes'][number][] {
  return Object.freeze(nodes.flatMap((node) => [node, ...flatten(node.children)]));
}

function scopeCandidate(route: RouteMatch): Readonly<{ kind: string; id: string }> {
  const parameters = route.parameters as Readonly<Record<string, string>>;
  const kind = parameters.scopeKind;
  const id = parameters.scopeId;
  if (kind === undefined || id === undefined) throw new Error('STORE_SCOPE_ROUTE_INVALID');
  return Object.freeze({ kind, id });
}

function authHref(origin: string, returnPath: string): string {
  const target = new URL('/', origin);
  target.searchParams.set('target', 'store');
  target.searchParams.set('returnpath', returnPath);
  return target.toString();
}
