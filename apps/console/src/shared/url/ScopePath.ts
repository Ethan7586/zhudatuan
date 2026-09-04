import { fillRouteTemplate, resolveRoutePath, ROUTE_BASE, type RouteId, type RouteParameters } from '../../generated/RouteBinding';

interface ScopeValue {
  readonly kind: string;
  readonly id: string;
}

type FeatureParameters<R extends RouteId> = Omit<RouteParameters<R>, 'scopeKind' | 'scopeId'>;
type FeatureArguments<R extends RouteId> = keyof FeatureParameters<R> extends never ? readonly [parameters?: never] : readonly [parameters: FeatureParameters<R>];

export function scopeRoutePath<R extends RouteId>(scope: ScopeValue, route: R, ...arguments_: FeatureArguments<R>): string {
  return resolveRoutePath(route, { scopeKind: scope.kind, scopeId: scope.id, ...(arguments_[0] ?? {}) });
}

export function scopeLandingPath(scope: ScopeValue): string {
  return fillRouteTemplate(ROUTE_BASE, { scopeKind: scope.kind, scopeId: scope.id });
}
