import type { OperationId } from '@shop/contract';
import { navigationForRoute } from '../generated/NavigationBinding';
import { ROUTE_FEATURES, type RouteId } from '../generated/RouteBinding';
import type { SupplierFeatureViewModel } from './FeatureViewModel';

export interface SupplierFeatureModule {
  readonly viewModel: SupplierFeatureViewModel;
}

export interface SupplierFeatureRoute {
  readonly routeid: RouteId;
  readonly operation: OperationId;
  readonly scope: 'supplier';
  readonly capability: string;
  readonly permission: string | null;
  readonly title: string;
  readonly breadcrumbs: readonly string[];
  readonly load: () => Promise<SupplierFeatureModule>;
}

export interface SupplierFeatureManifest {
  readonly feature: string;
  readonly scope: 'supplier';
  readonly routes: readonly SupplierFeatureRoute[];
}

type RouteDefinition = Omit<SupplierFeatureRoute, 'operation' | 'scope' | 'capability' | 'permission'>;

export function defineSupplierFeature(feature: string, routes: readonly RouteDefinition[]): SupplierFeatureManifest {
  if (routes.length === 0) throw new Error('SUPPLIER_FEATURE_ROUTE_MISSING');
  return Object.freeze({
    feature,
    scope: 'supplier',
    routes: Object.freeze(
      routes.map((route) => {
        if (ROUTE_FEATURES[route.routeid] !== feature) throw new Error(`SUPPLIER_FEATURE_ROUTE_INVALID:${route.routeid}`);
        const bindings = navigationForRoute(route.routeid);
        if (bindings.length !== 1 || bindings[0]!.scope !== 'supplier') throw new Error(`SUPPLIER_FEATURE_NAVIGATION_INVALID:${route.routeid}`);
        const binding = bindings[0]!;
        return Object.freeze({ ...route, breadcrumbs: Object.freeze([...route.breadcrumbs]), operation: binding.operation, scope: 'supplier', capability: binding.capability, permission: binding.permission });
      })
    ),
  });
}
