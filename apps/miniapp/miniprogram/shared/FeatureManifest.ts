import type { OperationId } from '@shop/contract';
import { navigationForRoute } from '../generated/NavigationBinding';
import { ROUTE_FEATURES, type RouteId } from '../generated/RouteBinding';
import type { MiniappFeatureViewModel } from './FeatureViewModel';

export interface MiniappManifestRoute {
  readonly routeid: RouteId;
  readonly operation: OperationId;
  readonly scope: 'mall';
  readonly capability: string;
  readonly permission: string | null;
  readonly title: string;
  readonly breadcrumbs: readonly string[];
  readonly load: () => Promise<unknown>;
}

export interface MiniappFeatureManifest {
  readonly feature: string;
  readonly scope: 'mall';
  readonly viewModel: MiniappFeatureViewModel;
  readonly routes: readonly MiniappManifestRoute[];
}

type RouteDefinition = Omit<MiniappManifestRoute, 'operation' | 'scope' | 'capability' | 'permission'>;

export function defineMiniappManifest(feature: string, viewModel: MiniappFeatureViewModel, routes: readonly RouteDefinition[]): MiniappFeatureManifest {
  if (routes.length === 0) throw new Error('MINIAPP_MANIFEST_ROUTE_MISSING');
  if (viewModel.routes.length !== routes.length || routes.some(({ routeid }) => !viewModel.routes.includes(routeid))) throw new Error(`MINIAPP_MANIFEST_VIEWMODEL_INVALID:${feature}`);
  return Object.freeze({
    feature,
    scope: 'mall',
    viewModel,
    routes: Object.freeze(
      routes.map((route) => {
        if (ROUTE_FEATURES[route.routeid] !== feature) throw new Error(`MINIAPP_MANIFEST_FEATURE_INVALID:${route.routeid}`);
        const bindings = navigationForRoute(route.routeid);
        if (bindings.length !== 1 || bindings[0]!.scope !== 'mall') throw new Error(`MINIAPP_MANIFEST_NAVIGATION_INVALID:${route.routeid}`);
        const binding = bindings[0]!;
        return Object.freeze({ ...route, breadcrumbs: Object.freeze([...route.breadcrumbs]), operation: binding.operation, scope: 'mall', capability: binding.capability, permission: binding.permission });
      })
    ),
  });
}
