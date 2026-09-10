import { RouteLoading } from '@shop/design';
import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import type { ShouldRevalidateFunctionArgs } from 'react-router';
import type { RouteRegistryContract } from '../shared/manifest/ComponentManifest';
import { relativeRoute, ROOT_PATH, ROUTE_BASE } from '../generated/RouteBinding';
import type { SessionPort } from '../entity/session/public/SessionPort';

const scopeShellModule = import('../shell/ScopeShell');
const ScopeShell = lazy(() => scopeShellModule.then((module) => ({ default: module.ScopeShell })));
const RouteError = lazy(() => import('./RouteError').then((module) => ({ default: module.RouteError })));
const FeatureRouteError = lazy(() => import('./RouteError').then((module) => ({ default: module.FeatureRouteError })));

export function createConsoleRouter(registry: RouteRegistryContract, session: SessionPort) {
  const sessionLoaders = loadSessionLoaders(registry, session);
  const featureRoutes = registry.routes().map(({ route, load }) => ({ path: relativeRoute(route.routeid), lazy: load, ErrorBoundary: IsolatedRouteError }));
  return createBrowserRouter([
    { path: ROOT_PATH, loader: async (args) => (await sessionLoaders).landingLoader(args), element: <RouteLoading />, HydrateFallback: RouteLoading, errorElement: <ApplicationRouteError /> },
    {
      id: 'scope',
      path: ROUTE_BASE,
      loader: async (args) => (await sessionLoaders).scopeLoader(args),
      shouldRevalidate: shouldRevalidateScope,
      element: (
        <Suspense fallback={<RouteLoading />}>
          <ScopeShell registry={registry} />
        </Suspense>
      ),
      HydrateFallback: RouteLoading,
      errorElement: <ApplicationRouteError />,
      children: [...featureRoutes, { path: '*', lazy: () => import('./NotFoundRoute'), ErrorBoundary: IsolatedRouteError }],
    },
    { path: '*', lazy: () => import('./NotFoundRoute') },
  ]);
}

export function shouldRevalidateScope({ currentParams, nextParams, currentUrl, nextUrl, formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs): boolean {
  if (currentParams.scopeKind !== nextParams.scopeKind || currentParams.scopeId !== nextParams.scopeId) return true;
  if (formMethod !== undefined) return true;
  if (currentUrl.pathname === nextUrl.pathname) return defaultShouldRevalidate;
  return false;
}

function ApplicationRouteError() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <RouteError />
    </Suspense>
  );
}

function IsolatedRouteError() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <FeatureRouteError />
    </Suspense>
  );
}

function loadSessionLoaders(registry: RouteRegistryContract, session: SessionPort) {
  return import('./SessionLoader').then(({ createSessionLoaders }) => createSessionLoaders(registry, session));
}
