import { createBrowserRouter, type RouteObject } from 'react-router';
import { ScopeShell } from '../shell/ScopeShell';
import { landingLoader, scopeLoader, scopeShouldRevalidate } from './SessionLoader';
import { consoleModules } from './ConsoleModuleRegistry';
import { materializeConsoleIndexRoute, materializeConsoleModules } from './ConsoleModuleRoutes';
import { RouteError } from './RouteError';

function ConsoleRouteError() {
  return <RouteError />;
}

function ConsoleRouteFallback() {
  return <main className="statemain" aria-label="页面加载状态"><p role="status">正在加载…</p></main>;
}

export const consoleScopeChildren = [
  materializeConsoleIndexRoute(consoleModules),
  ...materializeConsoleModules(consoleModules),
  { path: 'settings/profile', lazy: () => import('../feature/profile/ProfileRoute') },
  { path: '*', lazy: () => import('./NotFoundRoute') },
] satisfies RouteObject[];

const previewBasename = import.meta.env.VITE_ROUTER_BASENAME?.trim() || undefined;

export const consoleRouter = createBrowserRouter([
  {
    path: '/',
    loader: landingLoader,
    HydrateFallback: ConsoleRouteFallback,
    errorElement: <ConsoleRouteError />,
  },
  {
    id: 'scope',
    path: '/scopes/:scopeKind/:scopeId',
    loader: scopeLoader,
    shouldRevalidate: scopeShouldRevalidate,
    Component: ScopeShell,
    HydrateFallback: ConsoleRouteFallback,
    errorElement: <ConsoleRouteError />,
    children: consoleScopeChildren,
  },
  { path: '*', lazy: () => import('./NotFoundRoute') },
], previewBasename === undefined ? undefined : { basename: previewBasename });
