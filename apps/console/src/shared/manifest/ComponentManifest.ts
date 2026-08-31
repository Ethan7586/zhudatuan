import type { ComponentType } from 'react';
import { COMPONENT_KEYS, NAVIGATION_IDS, type ComponentKey, type NavigationId } from '../../generated/NavigationBinding';

export interface ComponentRoute {
  readonly route: string;
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
  hasComponent(component: string): component is ComponentKey;
}

export function defineComponent(definition: ComponentManifest): ComponentManifest {
  if (!COMPONENT_KEYS.includes(definition.component)) {
    throw new Error(`COMPONENT_KEY_INVALID:${definition.component}`);
  }
  if (definition.navigationids.length === 0) {
    throw new Error(`COMPONENT_NAVIGATION_MISSING:${definition.component}`);
  }
  for (const id of definition.navigationids) {
    if (!NAVIGATION_IDS.includes(id)) throw new Error(`COMPONENT_NAVIGATION_INVALID:${id}`);
  }
  if (definition.routes.length === 0) throw new Error(`COMPONENT_ROUTE_MISSING:${definition.component}`);
  for (const { route } of definition.routes) {
    if (!/^[a-z][a-z0-9]*(?:\/:?[a-z][A-Za-z0-9]*)*$/.test(route)) {
      throw new Error(`COMPONENT_ROUTE_INVALID:${definition.component}:${route}`);
    }
  }
  return Object.freeze({
    component: definition.component,
    navigationids: Object.freeze([...definition.navigationids]),
    routes: Object.freeze(definition.routes.map((route) => Object.freeze({ ...route }))),
    load: definition.load,
  });
}
