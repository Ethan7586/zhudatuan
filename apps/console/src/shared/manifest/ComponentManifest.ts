import type { ComponentType } from 'react';
import { COMPONENT_KEYS, NAVIGATION_IDS, type ComponentKey, type NavigationId } from '../../generated/NavigationBinding';
import { ROUTES, type RouteId } from '../../generated/RouteBinding';

export interface ComponentRoute {
  readonly routeid: RouteId;
  readonly load?: () => Promise<{ Component: ComponentType }>;
}

export interface ComponentManifest {
  readonly component: ComponentKey;
  readonly navigationids: readonly NavigationId[];
  readonly routes: readonly ComponentRoute[];
  readonly load: () => Promise<{ Component: ComponentType }>;
}

export interface RouteRegistryContract {
  all(): readonly ComponentManifest[];
  routes(): readonly Readonly<{
    manifest: ComponentManifest;
    route: ComponentRoute;
    load: () => Promise<{ Component: ComponentType }>;
  }>[];
  match(pathname: string): ComponentManifest | undefined;
  resolve(pathname: string): Readonly<{ routeid: RouteId; parameters: Readonly<Record<string, string>> }> | undefined;
  hasComponent(component: string): component is ComponentKey;
}

export function defineComponent(definition: ComponentManifest): ComponentManifest {
  if (!COMPONENT_KEYS.includes(definition.component)) {
    throw new Error(`COMPONENT_KEY_INVALID:${definition.component}`);
  }
  for (const id of definition.navigationids) {
    if (!NAVIGATION_IDS.includes(id)) throw new Error(`COMPONENT_NAVIGATION_INVALID:${id}`);
  }
  if (definition.routes.length === 0) throw new Error(`COMPONENT_ROUTE_MISSING:${definition.component}`);
  for (const { routeid } of definition.routes) {
    if (!(routeid in ROUTES)) throw new Error(`COMPONENT_ROUTE_INVALID:${definition.component}:${routeid}`);
  }
  return Object.freeze({
    component: definition.component,
    navigationids: Object.freeze([...definition.navigationids]),
    routes: Object.freeze(definition.routes.map((route) => Object.freeze({ ...route }))),
    load: definition.load,
  });
}
