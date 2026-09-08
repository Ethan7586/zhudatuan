import type { ComponentType } from 'react';
import { navigationForRoute } from '../../generated/NavigationBinding';
import { ROUTE_FEATURES, type RouteId } from '../../generated/RouteBinding';
import type { OperationId } from '@shop/contract';

export interface RouteModule {
  readonly Component: ComponentType;
}
interface StorefrontRouteDefinition {
  readonly routeid: RouteId;
  readonly protected: boolean;
  readonly load: () => Promise<RouteModule>;
}

export interface StorefrontRoute extends StorefrontRouteDefinition {
  readonly operation: OperationId;
  readonly scope: 'mall';
  readonly capability: string;
  readonly permission: string | null;
  readonly title: string;
  readonly breadcrumbs: readonly string[];
}

export interface StorefrontManifest {
  readonly feature: string;
  readonly scope: 'mall';
  readonly routes: readonly StorefrontRoute[];
  readonly fallback?: Readonly<{ load: () => Promise<RouteModule> }>;
}

interface StorefrontDefinition {
  readonly feature: string;
  readonly routes: readonly StorefrontRouteDefinition[];
  readonly fallback?: Readonly<{ load: () => Promise<RouteModule> }>;
}

export function defineManifest(definition: StorefrontDefinition): StorefrontManifest {
  if (definition.routes.length === 0) throw new Error('STOREFRONT_MANIFEST_ROUTE_MISSING');
  const routes = definition.routes.map((route): StorefrontRoute => {
    if (ROUTE_FEATURES[route.routeid] !== definition.feature) throw new Error(`STOREFRONT_MANIFEST_FEATURE_INVALID:${route.routeid}`);
    const bindings = navigationForRoute(route.routeid);
    if (bindings.length !== 1) throw new Error(`STOREFRONT_MANIFEST_NAVIGATION_INVALID:${route.routeid}`);
    const binding = bindings[0];
    return Object.freeze({
      ...route,
      operation: binding.operation,
      scope: 'mall',
      capability: binding.capability,
      permission: binding.permission,
      title: binding.title,
      breadcrumbs: Object.freeze([...binding.breadcrumbs]),
    });
  });
  return Object.freeze({ feature: definition.feature, scope: 'mall', routes: Object.freeze(routes), ...(definition.fallback ? { fallback: definition.fallback } : {}) });
}
