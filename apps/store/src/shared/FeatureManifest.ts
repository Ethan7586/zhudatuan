import type { OperationId } from '@shop/contract';
import { navigationForRoute } from '../generated/NavigationBinding';
import { ROUTE_FEATURES, type RouteId } from '../generated/RouteBinding';
import type { StoreFeatureViewModel } from './FeatureViewModel';

export interface StoreFeatureModule {
  readonly viewModel: StoreFeatureViewModel;
}

export interface StoreFeatureRoute {
  readonly routeid: RouteId;
  readonly operation: OperationId;
  readonly scope: 'store';
  readonly capability: string;
  readonly permission: string | null;
  readonly title: string;
  readonly breadcrumbs: readonly string[];
  readonly load: () => Promise<StoreFeatureModule>;
}

export interface StoreFeatureManifest {
  readonly feature: string;
  readonly scope: 'store';
  readonly routes: readonly StoreFeatureRoute[];
}

type RouteDefinition = Omit<StoreFeatureRoute, 'operation' | 'scope' | 'capability' | 'permission'>;

export function defineStoreFeature(feature: string, routes: readonly RouteDefinition[]): StoreFeatureManifest {
  if (routes.length === 0) throw new Error('STORE_FEATURE_ROUTE_MISSING');
  return Object.freeze({
    feature,
    scope: 'store',
    routes: Object.freeze(
      routes.map((route) => {
        if (ROUTE_FEATURES[route.routeid] !== feature) throw new Error(`STORE_FEATURE_ROUTE_INVALID:${route.routeid}`);
        const bindings = navigationForRoute(route.routeid);
        if (bindings.length !== 1 || bindings[0]!.scope !== 'store') throw new Error(`STORE_FEATURE_NAVIGATION_INVALID:${route.routeid}`);
        const binding = bindings[0]!;
        return Object.freeze({ ...route, breadcrumbs: Object.freeze([...route.breadcrumbs]), operation: binding.operation, scope: 'store', capability: binding.capability, permission: binding.permission });
      })
    ),
  });
}
