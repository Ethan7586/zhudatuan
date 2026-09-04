import type { RequestContext, SupplierSurfaceClient } from '@shop/sdk';
import type { RouteId, RouteMatch } from '../generated/RouteBinding';

export interface SupplierFeatureViewModel {
  readonly routes: readonly RouteId[];
  readonly title: string;
  readonly description: string;
  readonly read: (client: SupplierSurfaceClient, context: RequestContext, route: RouteMatch) => Promise<unknown>;
}

export function defineSupplierViewModel(definition: SupplierFeatureViewModel): SupplierFeatureViewModel {
  if (definition.routes.length === 0) throw new Error('SUPPLIER_VIEWMODEL_ROUTE_MISSING');
  return Object.freeze({ ...definition, routes: Object.freeze([...definition.routes]) });
}
