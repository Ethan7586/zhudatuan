import { RouteLoading } from '@shop/design';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import type { RouteRegistryContract } from '../shared/manifest/ComponentManifest';
import { relativeRoute, ROOT_PATH, ROUTE_BASE } from '../generated/RouteBinding';
import type { SessionPort } from '../entity/session/public/SessionPort';
import { RouteError } from './RouteError';

const ScopeShell = lazy(() => import('../shell/ScopeShell').then((module) => ({ default: module.ScopeShell })));

export function createConsoleRouter(registry: RouteRegistryContract, session: SessionPort) {
  const sessionLoaders = loadSessionLoaders(registry, session);
  return createBrowserRouter([
    { path: ROOT_PATH, loader: async (args) => (await sessionLoaders).landingLoader(args), element: <RouteLoading />, HydrateFallback: RouteLoading, errorElement: <RouteError /> },
    {
      id: 'scope',
      path: ROUTE_BASE,
      loader: async (args) => (await sessionLoaders).scopeLoader(args),
      element: (
        <Suspense fallback={<RouteLoading />}>
          <ScopeShell registry={registry} />
        </Suspense>
      ),
      HydrateFallback: RouteLoading,
      errorElement: <RouteError />,
      children: [{ index: true, element: <Navigate to={relativeRoute('consolecockpit')} replace /> }, ...registry.routes().map(({ route, load }) => ({ path: relativeRoute(route.routeid), lazy: load })), { path: '*', lazy: () => import('./NotFoundRoute') }],
    },
    { path: '*', lazy: () => import('./NotFoundRoute') },
  ]);
}

function loadSessionLoaders(registry: RouteRegistryContract, session: SessionPort) {
  return import('./SessionLoader').then(({ createSessionLoaders }) => createSessionLoaders(registry, session));
}
