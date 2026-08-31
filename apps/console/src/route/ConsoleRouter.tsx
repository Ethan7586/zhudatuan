import { createBrowserRouter, type RouteObject } from 'react-router';
import { RouteFallback } from '@shop/design';
import { RouteError } from './RouteError';
import { ScopeShell } from '../shell/ScopeShell';
import { landingLoader, scopeLoader } from './SessionLoader';
import { consoleModules } from './ConsoleModuleRegistry';
import { materializeConsoleIndexRoute, materializeConsoleModules } from './ConsoleModuleRoutes';

export const consoleScopeChildren = [
  materializeConsoleIndexRoute(consoleModules),
  ...materializeConsoleModules(consoleModules),
  { path: '*', lazy: () => import('./NotFoundRoute') },
] satisfies RouteObject[];

const previewBasename = import.meta.env.VITE_ROUTER_BASENAME?.trim() || undefined;

export const consoleRouter = createBrowserRouter([
  {
    path: '/',
    loader: landingLoader,
    HydrateFallback: RouteFallback,
    errorElement: <RouteError />,
  },
  {
    id: 'scope',
    path: '/scopes/:scopeKind/:scopeId',
    loader: scopeLoader,
    Component: ScopeShell,
    HydrateFallback: RouteFallback,
    errorElement: <RouteError />,
    children: consoleScopeChildren,
  },
  { path: '*', lazy: () => import('./NotFoundRoute') },
], previewBasename === undefined ? undefined : { basename: previewBasename });
