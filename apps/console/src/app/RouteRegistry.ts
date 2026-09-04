import { matchPath } from 'react-router';
import { COMPONENT_KEYS, NAVIGATION_IDS } from '../generated/NavigationBinding';
import { ROUTES, ROUTE_FEATURES, type RouteId } from '../generated/RouteBinding';
import type { ComponentManifest, ComponentRoute } from '../shared/manifest/ComponentManifest';

const modules = import.meta.glob<Readonly<Record<string, unknown>>>('../feature/**/Manifest.ts', { eager: true });
const manifests = Object.freeze(Object.values(modules).flatMap((module) => Object.values(module).filter(isManifest)));
const components = new Set<string>();
const navigationids = new Set<string>();
const routeids = new Set<RouteId>();

for (const manifest of manifests) {
  if (components.has(manifest.component)) throw new Error(`COMPONENT_DUPLICATE:${manifest.component}`);
  components.add(manifest.component);
  for (const id of manifest.navigationids) {
    if (navigationids.has(id)) throw new Error(`NAVIGATION_BINDING_DUPLICATE:${id}`);
    navigationids.add(id);
  }
  for (const route of manifest.routes) {
    if (routeids.has(route.routeid)) throw new Error(`COMPONENT_ROUTE_DUPLICATE:${route.routeid}`);
    if (ROUTE_FEATURES[route.routeid] !== manifest.component) throw new Error(`COMPONENT_ROUTE_FEATURE_MISMATCH:${route.routeid}:${manifest.component}`);
    routeids.add(route.routeid);
  }
}
for (const component of COMPONENT_KEYS) if (!components.has(component)) throw new Error(`COMPONENT_BINDING_MISSING:${component}`);
for (const id of NAVIGATION_IDS) if (!navigationids.has(id)) throw new Error(`NAVIGATION_BINDING_MISSING:${id}`);
for (const routeid of Object.keys(ROUTES) as RouteId[]) if (!routeids.has(routeid)) throw new Error(`COMPONENT_ROUTE_MISSING:${routeid}`);

const routeBindings = Object.freeze(manifests.flatMap((manifest) => manifest.routes.map((route) => Object.freeze({ manifest, route, load: route.load ?? manifest.load }))));
export const RouteRegistry = Object.freeze({
  all: (): readonly ComponentManifest[] => manifests,
  routes: () => routeBindings,
  match(pathname: string): ComponentManifest | undefined {
    return routeBindings.find(({ route }) => matchPath({ path: ROUTES[route.routeid], end: true }, pathname))?.manifest;
  },
  resolve(pathname: string) {
    for (const { route } of routeBindings) {
      const match = matchPath({ path: ROUTES[route.routeid], end: true }, pathname);
      if (match === null) continue;
      const parameters = Object.fromEntries(
        Object.entries(match.params)
          .filter((entry): entry is [string, string] => entry[1] !== undefined)
          .map(([name, value]) => [name, decodeRouteParameter(name, value)])
      );
      return Object.freeze({ routeid: route.routeid, parameters: Object.freeze(parameters) });
    }
    return undefined;
  },
  hasComponent(component: string): component is (typeof COMPONENT_KEYS)[number] {
    return components.has(component);
  },
});
function isManifest(value: unknown): value is ComponentManifest {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ComponentManifest>;
  return typeof item.component === 'string' && Array.isArray(item.navigationids) && Array.isArray(item.routes) && typeof item.load === 'function';
}

function decodeRouteParameter(name: string, value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`ROUTE_PARAMETER_ENCODING_INVALID:${name}`);
  }
}

export type ConsoleRouteBinding = Readonly<{ manifest: ComponentManifest; route: ComponentRoute; load: ComponentManifest['load'] }>;
