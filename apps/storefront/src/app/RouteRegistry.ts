import { ROUTES, type RouteId } from '../generated/RouteBinding';
import type { StorefrontManifest } from '../shared/manifest/StorefrontManifest';

const modules = import.meta.glob<Readonly<Record<string, unknown>>>('../feature/**/Manifest.ts', { eager: true });
const manifests = Object.freeze(Object.values(modules).flatMap((module) => Object.values(module).filter(isManifest)));
const routeids = new Set<RouteId>();
for (const manifest of manifests) for (const route of manifest.routes) {
  if (routeids.has(route.routeid)) throw new Error(`STOREFRONT_ROUTE_DUPLICATE:${route.routeid}`);
  routeids.add(route.routeid);
}
for (const routeid of Object.keys(ROUTES) as RouteId[]) if (!routeids.has(routeid)) throw new Error(`STOREFRONT_ROUTE_MANIFEST_MISSING:${routeid}`);
export const RouteRegistry = Object.freeze({ all: () => manifests, routes: () => Object.freeze(manifests.flatMap(({ routes }) => routes)) });
function isManifest(value: unknown): value is StorefrontManifest { if (!value || typeof value !== 'object') return false; const item = value as Partial<StorefrontManifest>; return typeof item.feature === 'string' && Array.isArray(item.routes); }
