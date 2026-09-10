import { RouteLoading } from '@shop/design';
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { RouteRegistry } from '../app/RouteRegistry';
import { matchRoutePath, ROUTES, type RouteId } from '../generated/RouteBinding';
import type { RouteModule, StorefrontRoute } from '../shared/manifest/StorefrontManifest';
import { useShellViewModel } from '../shell/ShellViewModel';
import { StorefrontShell } from '../shell/StorefrontShell';
import { Guard } from './Guard';
import { Scroll } from './Scroll';

const moduleCache = new Map<RouteId, Promise<RouteModule>>();
let fallbackModule: Promise<RouteModule> | undefined;
const bindings = RouteRegistry.routes().map((route) => Object.freeze({ ...route, Component: lazy(() => loadRoute(route).then((module) => ({ default: module.Component }))) }));
const PublishedRoute = lazy(() => loadFallback().then((module) => ({ default: module.Component })));

export function preloadStorefrontRoute(pathname: string): void {
  const match = matchRoutePath(pathname);
  if (match === undefined) {
    void loadFallback().catch(() => undefined);
    return;
  }
  const route = bindings.find((candidate) => candidate.routeid === match.id);
  if (route !== undefined) void loadRoute(route).catch(() => undefined);
}

export function Router() {
  const shell = useShellViewModel();
  return (
    <StorefrontShell viewmodel={shell}>
      <Scroll />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          {bindings.map(({ routeid, protected: guarded, Component }) => (
            <Route
              key={routeid}
              path={ROUTES[routeid]}
              element={
                guarded ? (
                  <Guard>
                    <Component />
                  </Guard>
                ) : (
                  <Component />
                )
              }
            />
          ))}
          <Route path="*" element={<PublishedRoute />} />
        </Routes>
      </Suspense>
    </StorefrontShell>
  );
}

function loadRoute(route: StorefrontRoute): Promise<RouteModule> {
  const prior = moduleCache.get(route.routeid);
  if (prior !== undefined) return prior;
  const pending = route.load().catch((cause) => {
    moduleCache.delete(route.routeid);
    throw cause;
  });
  moduleCache.set(route.routeid, pending);
  return pending;
}

function loadFallback(): Promise<RouteModule> {
  if (fallbackModule !== undefined) return fallbackModule;
  fallbackModule = RouteRegistry.fallback()
    .load()
    .catch((cause) => {
      fallbackModule = undefined;
      throw cause;
    });
  return fallbackModule;
}
