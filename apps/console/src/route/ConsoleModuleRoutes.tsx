import { Navigate, type RouteObject } from 'react-router';
import type {
  ConsoleModuleId,
  ConsoleModuleManifest,
  ConsoleModuleRoute,
  ConsoleRouteHandle,
  RoutePresentation,
} from '../entity/navigation/ConsoleModuleManifest';
import { isConsoleModuleId } from '../entity/navigation/ConsoleModuleManifest';
import type { ConsoleScope } from '../entity/session/ConsoleSession';

export interface ResolvedConsoleRoutePresentation {
  readonly title: string;
  readonly summary: string;
}

export function resolveConsoleRoutePresentation(
  presentation: RoutePresentation,
  scopeKind: ConsoleScope['kind'],
): ResolvedConsoleRoutePresentation {
  const override = presentation.byScopeKind?.[scopeKind] ?? presentation.byScopeKind?.enterprise;
  return {
    title: override?.title ?? presentation.title,
    summary: override?.summary ?? presentation.summary,
  };
}

export function isConsoleRouteHandle(value: unknown): value is ConsoleRouteHandle {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ConsoleRouteHandle>;
  return typeof candidate.moduleId === 'string'
    && isConsoleModuleId(candidate.moduleId)
    && typeof candidate.routeId === 'string'
    && candidate.routeId.startsWith(`${candidate.moduleId}.`);
}

export function deepestConsoleRouteHandle(
  matches: readonly Readonly<{ handle: unknown }>[],
): ConsoleRouteHandle | undefined {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    if (match !== undefined && isConsoleRouteHandle(match.handle)) return match.handle;
  }
  return undefined;
}

export function materializeConsoleModule<Id extends ConsoleModuleId>(
  module: ConsoleModuleManifest<Id>,
): RouteObject[] {
  if (module.status === 'hidden') return [];
  return module.routes.map((route) => materializeConsoleRoute(module, route));
}

export function materializeConsoleModules(
  modules: readonly ConsoleModuleManifest[],
): RouteObject[] {
  const routes: RouteObject[] = [];
  for (const module of modules) routes.push(...materializeConsoleModule(module));
  return routes;
}

export function selectDefaultConsoleEntry(
  modules: readonly ConsoleModuleManifest[],
): string | undefined {
  let selected: Readonly<{ order: number; path: string }> | undefined;
  for (const module of modules) {
    if (module.status !== 'enabled' || module.navigation.placement !== 'main') continue;
    const entry = module.routes.find(({ kind }) => kind === 'entry');
    if (entry === undefined) continue;
    if (selected === undefined || module.navigation.order < selected.order) {
      selected = { order: module.navigation.order, path: entry.path };
    }
  }
  return selected?.path;
}

export function materializeConsoleIndexRoute(
  modules: readonly ConsoleModuleManifest[],
): RouteObject {
  const defaultEntry = selectDefaultConsoleEntry(modules);
  return defaultEntry === undefined
    ? { index: true, lazy: () => import('./NotFoundRoute') }
    : { index: true, element: <Navigate to={defaultEntry} replace /> };
}

function materializeConsoleRoute<Id extends ConsoleModuleId>(
  module: ConsoleModuleManifest<Id>,
  route: ConsoleModuleRoute<Id>,
): RouteObject {
  const handle: ConsoleRouteHandle<Id> = {
    moduleId: module.id,
    routeId: route.id,
    kind: route.kind,
    presentation: route.presentation,
    operations: route.operations,
    ...('blocker' in route && route.blocker !== undefined ? { blocker: route.blocker } : {}),
  };
  const base = { id: route.id, path: route.path, handle };

  if (module.status === 'disabled') return {
    ...base,
    lazy: async () => {
      const { ModuleDisabledRoute } = await import('./ModuleDisabledRoute');
      return { Component: ModuleDisabledRoute };
    },
  };
  if (route.kind === 'redirect') {
    return { ...base, element: <Navigate to={route.redirectTo} replace /> };
  }
  return { ...base, lazy: route.lazy };
}
