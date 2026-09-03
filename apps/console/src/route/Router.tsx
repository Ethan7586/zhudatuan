import { RouteLoading } from '@shop/design';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import type { RouteRegistryContract } from '../shared/manifest/ComponentManifest';
import { relativeRoute } from '../app/RouteRegistry';
import { RouteError } from './RouteError';

const ScopeShell = lazy(() => import('../shell/ScopeShell').then((module) => ({ default: module.ScopeShell })));

export function createConsoleRouter(registry: RouteRegistryContract) {
  const sessionLoaders = loadSessionLoaders(registry);
  return createBrowserRouter([
    { path: '/', loader: async (args) => (await sessionLoaders).landingLoader(args), element: <RouteLoading />, HydrateFallback: RouteLoading, errorElement: <RouteError /> },
    {
      id: 'scope',
      path: '/scopes/:scopeKind/:scopeId',
      loader: async (args) => (await sessionLoaders).scopeLoader(args),
      element: (
        <Suspense fallback={<RouteLoading />}>
          <ScopeShell registry={registry} />
        </Suspense>
      ),
      HydrateFallback: RouteLoading,
      errorElement: <RouteError />,
      children: [{ index: true, element: <Navigate to="cockpit" replace /> }, ...registry.routes().map(({ route, load }) => ({ path: relativeRoute(route.routeid), lazy: load })), { path: '*', lazy: () => import('./NotFoundRoute') }],
    },
    { path: '*', lazy: () => import('./NotFoundRoute') },
  ]);
}

function loadSessionLoaders(registry: RouteRegistryContract) {
  return import('./SessionLoader').then(({ createSessionLoaders }) => createSessionLoaders(registry));
}
