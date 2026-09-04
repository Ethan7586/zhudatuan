import type { ComponentType } from 'react';
import { COMPONENT_KEYS, NAVIGATION_BY_ID, NAVIGATION_IDS, type ComponentKey, type NavigationId, type NavigationManifest } from '../../generated/NavigationBinding';
import { ROUTES, type RouteId } from '../../generated/RouteBinding';

interface ComponentRouteDefinition {
  readonly routeid: RouteId;
  readonly load?: () => Promise<{ Component: ComponentType }>;
}

export type ComponentRouteBinding = Readonly<Pick<NavigationManifest, 'key' | 'operation' | 'scope' | 'capability' | 'permission' | 'title' | 'breadcrumbs'>>;

export interface ComponentRoute extends ComponentRouteDefinition {
  readonly bindings: readonly ComponentRouteBinding[];
}

export interface ComponentManifest {
  readonly component: ComponentKey;
  readonly navigationids: readonly NavigationId[];
  readonly routes: readonly ComponentRoute[];
  readonly load: () => Promise<{ Component: ComponentType }>;
}

interface ComponentDefinition extends Omit<ComponentManifest, 'routes'> {
  readonly routes: readonly ComponentRouteDefinition[];
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

export function defineComponent(definition: ComponentDefinition): ComponentManifest {
  if (!COMPONENT_KEYS.includes(definition.component)) {
    throw new Error(`COMPONENT_KEY_INVALID:${definition.component}`);
  }
  for (const id of definition.navigationids) {
    if (!NAVIGATION_IDS.includes(id)) throw new Error(`COMPONENT_NAVIGATION_INVALID:${id}`);
    const navigation = NAVIGATION_BY_ID.get(id);
    if (navigation === undefined || navigation.feature !== definition.component) throw new Error(`COMPONENT_NAVIGATION_FEATURE_INVALID:${id}`);
  }
  if (definition.routes.length === 0) throw new Error(`COMPONENT_ROUTE_MISSING:${definition.component}`);
  const routes = definition.routes.map((route): ComponentRoute => {
    const { routeid } = route;
    if (!(routeid in ROUTES)) throw new Error(`COMPONENT_ROUTE_INVALID:${definition.component}:${routeid}`);
    const bindings = definition.navigationids.flatMap((id) => {
      const item = NAVIGATION_BY_ID.get(id);
      return item?.routeKey === routeid ? [item] : [];
    });
    if (bindings.length === 0) throw new Error(`COMPONENT_ROUTE_NAVIGATION_MISSING:${definition.component}:${routeid}`);
    return Object.freeze({ ...route, bindings: Object.freeze(bindings) });
  });
  const routeids = new Set(routes.map(({ routeid }) => routeid));
  for (const id of definition.navigationids) {
    const navigation = NAVIGATION_BY_ID.get(id);
    if (navigation === undefined || !routeids.has(navigation.routeKey as RouteId)) throw new Error(`COMPONENT_NAVIGATION_ROUTE_MISSING:${id}`);
  }
  return Object.freeze({
    component: definition.component,
    navigationids: Object.freeze([...definition.navigationids]),
    routes: Object.freeze(routes),
    load: definition.load,
  });
}
