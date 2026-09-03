import { ROUTES, type RouteId } from '../generated/RouteBinding';
import type { AuthManifest } from '../shared/manifest/AuthManifest';

const modules = import.meta.glob<Readonly<Record<string, unknown>>>('../feature/**/Manifest.ts', { eager: true });
const manifests = Object.freeze(Object.values(modules).flatMap((module) => Object.values(module).filter(isManifest)));
const ids = new Set<RouteId>();
for (const manifest of manifests) {
  if (ids.has(manifest.routeid)) throw new Error(`AUTH_ROUTE_DUPLICATE:${manifest.routeid}`);
  ids.add(manifest.routeid);
}
for (const routeid of Object.keys(ROUTES) as RouteId[]) if (!ids.has(routeid)) throw new Error(`AUTH_ROUTE_MANIFEST_MISSING:${routeid}`);

export const RouteRegistry = Object.freeze({ all: () => manifests });

function isManifest(value: unknown): value is AuthManifest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AuthManifest>;
  return typeof candidate.routeid === 'string' && candidate.routeid in ROUTES && typeof candidate.load === 'function';
}
